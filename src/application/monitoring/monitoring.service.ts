import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import { delay, groupPostsByType } from 'src/common/utils/helper';
import { RedisService } from 'src/infra/redis/redis.service';
import { DataSource, Repository } from 'typeorm';
import { CommentsService } from '../comments/comments.service';
import { CommentEntity } from '../../domain/entity/comment.entity';
import { CookieService } from '../cookie/cookie.service';
import { FacebookService } from '../facebook/facebook.service';
import { ICommentResponse } from '../facebook/facebook.service.i';
import { GetUuidUserUseCase } from '../facebook/usecase/get-uuid-user/get-uuid-user';
import {
  LinkEntity,
  LinkStatus,
  LinkType
} from '../../domain/entity/links.entity';
import { LinkService } from '../links/links.service';
import { ProxyEntity } from '../../domain/entity/proxy.entity';
import { ProxyService } from '../proxy/proxy.service';
import { DelayEntity } from '../../domain/entity/delay.entity';
import { SettingService } from '../setting/setting.service';
import { TokenService } from '../token/token.service';
import { UserEntity } from '../../domain/entity/user.entity';
import { KEY_PROCESS_QUEUE } from './monitoring.service.i';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { MonitoringConsumer } from './monitoring.process';
const proxy_check = require('proxy-check');

dayjs.extend(utc);

type RefreshKey = 'refreshToken' | 'refreshCookie' | 'refreshProxy';
@Injectable()
export class MonitoringService implements OnModuleInit {
  postIdRunning: string[] = []
  linksPublic: LinkEntity[] = []
  linksPrivate: LinkEntity[] = []
  isHandleUrl: boolean = false
  isReHandleUrl: boolean = false
  isHandleUuid: boolean = false
  isCheckProxy: boolean = false
  isUpdatePostIdV1: boolean = false
  private jobIntervalHandlers: Record<RefreshKey, NodeJS.Timeout> = {
    refreshToken: null,
    refreshCookie: null,
    refreshProxy: null,
  };

  private currentRefreshMs: Record<RefreshKey, number> = {
    refreshToken: 0,
    refreshCookie: 0,
    refreshProxy: 0,
  };

  constructor(
    @InjectRepository(LinkEntity)
    private linkRepository: Repository<LinkEntity>,
    private readonly facebookService: FacebookService,
    @InjectRepository(ProxyEntity)
    private proxyRepository: Repository<ProxyEntity>,
    @InjectRepository(DelayEntity)
    private delayRepository: Repository<DelayEntity>,
    private proxyService: ProxyService,
    private linkService: LinkService,
    private tokenService: TokenService,
    private cookieService: CookieService,
    private redisService: RedisService,
    private connection: DataSource,
    @InjectQueue(KEY_PROCESS_QUEUE.ADD_COMMENT) private monitoringQueue: Queue,
    private consumer: MonitoringConsumer
  ) {
    console.log(1111111111111)
  }

  async onModuleInit() {
    // Bắt đầu kiểm tra định kỳ từng loại
    ['refreshToken', 'refreshCookie', 'refreshProxy', 'delayCommentCount'].forEach((key: RefreshKey) => {
      setInterval(() => this.checkAndUpdateScheduler(key), 10 * 1000);
      this.checkAndUpdateScheduler(key); // gọi ngay lúc khởi động
    });
  }

  private async checkAndUpdateScheduler(key: RefreshKey) {
    const config = await this.delayRepository.find();
    if (!config.length) return;
    const newRefreshMs = (config[0][key] ?? 60) * 60 * 1000;

    if (newRefreshMs !== this.currentRefreshMs[key]) {
      this.currentRefreshMs[key] = newRefreshMs;

      if (this.jobIntervalHandlers[key]) {
        clearInterval(this.jobIntervalHandlers[key]);
      }

      this.jobIntervalHandlers[key] = setInterval(() => {
        this.doScheduledJob(key);
      }, newRefreshMs);

      console.log(`🔄 Đặt lại job "${key}" mỗi ${newRefreshMs / 1000}s`);
    }
  }

  private async doScheduledJob(key: RefreshKey) {
    if (key === "refreshToken") {
      return this.tokenService.updateActiveAllToken()
    }
    if (key === "refreshCookie") {
      return this.cookieService.updateActiveAllCookie()
    }
    if (key === "refreshProxy") {
      return this.proxyService.updateActiveAllProxy()
    }
    if (key === "delayCommentCount") {
      return this.startProcessTotalCount()
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async startMonitoring() {
    const postsStarted = await this.linkService.getPostStarted()
    const groupPost = groupPostsByType(postsStarted || []);
    for (const element of postsStarted) {
      const itemPublic = this.linksPublic.find(item => item.id === element.id)
      if (itemPublic) {
        itemPublic.delayTime = element.delayTime
      }

      const itemPrivate = this.linksPrivate.find(item => item.id === element.id)
      if (itemPrivate) {
        itemPrivate.delayTime = element.delayTime
      }
    }

    return Promise.all([this.handleStartMonitoring((groupPost.public || []), LinkType.PUBLIC), this.handleStartMonitoring((groupPost.private || []), LinkType.PRIVATE)])
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  SLAVEOF() {
    return this.redisService.SLAVEOF()
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async cronjobHandleProfileUrl() {
    if (this.isHandleUrl) {
      return
    }

    const links = await this.linkService.getLinksWithoutProfile()
    if (links.length === 0) {
      this.isHandleUrl = false
      return
    };

    this.isHandleUrl = true
    const BATCH_SIZE = 10;

    for (let i = 0; i < links.length; i += BATCH_SIZE) {
      const batch = links.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (link) => {
        const { type, name, postId, pageId, content } = await this.facebookService.getProfileLink(link.linkUrl) || {} as any;

        if (postId) {
          const exitLink = await this.linkRepository.findOne({
            where: {
              postId,
              userId: link.userId
            }
          });
          if (exitLink) {
            await this.linkRepository.delete(link.id);
            return; // skip saving
          }
        }

        if (!link.linkName || link.linkName.length === 0) {
          link.linkName = name;
        }

        link.process = type === LinkType.UNDEFINED ? false : true;
        link.type = type;
        link.postId = postId;
        link.pageId = pageId
        link.content = content;

        if (type !== LinkType.UNDEFINED) {
          const delayTime = await this.getDelayTime(link.status, type, link.user.delayOnPrivate)
          link.delayTime = delayTime
        }

        if (postId) {
          link.postIdV1 =
            type === LinkType.PUBLIC
              ? await this.facebookService.getPostIdPublicV1(link.linkUrl)
              : null;
        }

        await this.linkRepository.save(link);
      }));
    }

    this.isHandleUrl = false
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async checkProxy() {
    if (this.isCheckProxy) return

    this.isCheckProxy = true
    const proxyInActive = await this.proxyRepository.find()

    for (const proxy of proxyInActive) {
      const [host, port, username, password] = proxy.proxyAddress.split(':');
      const config = {
        host,
        port,
        proxyAuth: `${username}:${password}`
      };
      proxy_check(config).then(async (res) => {
        if (res) {
          // const status = await this.facebookService.checkProxyBlock(proxy)
          // if (!status) {
          await this.proxyService.updateProxyActive(proxy)
          // } else {
          //   await this.proxyService.updateProxyFbBlock(proxy)
          // }
        }
      }).catch(async (e) => {
        await this.proxyService.updateProxyDie(proxy)
      });
    }
    this.isCheckProxy = false
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async deleteDataDie() {
    // return this.proxyService.deleteProxyDie()
    this.cookieService.deleteCookieDie()
    this.tokenService.deleteTokenDie()
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async updateUUIDUser() {
    if (!this.isHandleUuid) {
      this.isHandleUuid = true
      await this.facebookService.updateUUIDUser()
      this.isHandleUuid = false
    }
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async updatePostIdV1() {
    if (this.isUpdatePostIdV1) return
    this.isUpdatePostIdV1 = true
    const links = await this.linkService.getAllLinkPublicPostIdV1Null()
    for (const link of links) {
      try {
        const id = await this.facebookService.getPostIdPublicV1(link.linkUrl)
        if (id) {
          await this.linkRepository.update(link.id, { postIdV1: id })
          this.linksPublic = this.linksPublic.filter(item => item.id === link.id)
        }
      } catch (error) { }
    }
    this.isUpdatePostIdV1 = false
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  removeDupRow() {
    return this.connection.query(`
      WITH ranked AS (
          SELECT *,
                ROW_NUMBER() OVER (PARTITION BY post_id, cmtid, link_id ORDER BY post_id) AS rn
          FROM comments
        )

        DELETE FROM comments
        WHERE (post_id, cmtid, link_id, id) IN (
          SELECT post_id, cmtid, link_id, id
          FROM ranked
          WHERE rn > 1
        )
      `)
  }

  async startProcessTotalCount() {
    const postsStarted = await this.linkService.getPostStarted()
    const groupPost = groupPostsByType(postsStarted || []);

    const processLinksPulic = async () => {
      const links = groupPost.public ?? [];
      const batchSize = 10;

      // Hàm xử lý một link
      const processLink = async (link: LinkEntity) => {
        try {
          const res = await this.facebookService.getCountLikePublic(link.linkUrl);
          const totalCount = res?.totalCount;
          const totalLike = res?.totalLike;
          const oldCountCmt = link.countBefore;
          const oldLike = link.likeBefore;


          if (totalCount) {
            link.countBefore = totalCount;
            const difference = totalCount - (oldCountCmt ?? 0)

            if (totalCount > difference && difference > 0) {
              link.lastCommentTime = dayjs().utc().format('YYYY-MM-DD HH:mm:ss') as any
              link.countAfter = difference
            }
          }

          if (totalLike) {
            link.likeBefore = totalLike;
            const difference = totalLike - (oldLike ?? 0)
            if (totalLike > difference && difference > 0) {
              link.likeAfter = difference
            }
          }

          await this.linkRepository.save(link);
        } catch (error) {
          console.log("🚀 ~ MonitoringService ~ processLinksPulic ~ error:", error?.message);
        }
      };

      for (let i = 0; i < links.length; i += batchSize) {
        const batch = links.slice(i, i + batchSize);
        await Promise.all(batch.map(link => processLink(link)));
      }
    }

    const processLinksPrivate = async () => {
      const links = groupPost.private ?? [];
      const batchSize = 10;


      const processPrivateLink = async (link: any) => {
        const proxy = await this.proxyService.getRandomProxy();
        if (!proxy) return;

        try {
          const res = await this.facebookService.getTotalCountWithToken(link);

          if (res?.totalCountCmt && res?.totalCountLike) {
            const oldCountCmt = link.countBefore;
            const oldLike = link.likeBefore;

            link.countBefore = res.totalCountCmt;
            const differenceCmt = res.totalCountCmt - (oldCountCmt ?? 0)

            if (res.totalCountCmt > differenceCmt && differenceCmt > 0) {
              link.countAfter = differenceCmt
            }

            link.likeBefore = res.totalCountLike;
            const differenceLike = res.totalCountLike - (oldLike ?? 0)
            if (res.totalCountLike > differenceLike && differenceLike > 0) {
              link.likeAfter = differenceLike
            }

            await this.linkRepository.save(link);
          }
        } catch (error) {
          console.log("🚀 ~ MonitoringService ~ processPrivateLinks ~ error:", error?.message);
        }
      };

      for (let i = 0; i < links.length; i += batchSize) {
        const batch = links.slice(i, i + batchSize);
        await Promise.all(batch.map(link => processPrivateLink(link)));
      }
    }

    const processTotalComment = async () => {
      const batchSize = 100;
      for (let i = 0; i < postsStarted.length; i += batchSize) {
        const batch = postsStarted.slice(i, i + batchSize);
        const linkIds = batch.map(item => item.id)
        await this.linkService.processTotalComment(linkIds)
      }

    }

    return Promise.all([processLinksPrivate(), processLinksPulic(), processTotalComment()])
  }

  handleStartMonitoring(links: LinkEntity[], type: LinkType) {
    let oldLinksRunning = []
    if (type === LinkType.PUBLIC) {
      oldLinksRunning = this.linksPublic
    } else {
      oldLinksRunning = this.linksPrivate
    }


    const oldIdsSet = new Set(oldLinksRunning.map(item => item.id));
    const linksRunning = links.filter(item => !oldIdsSet.has(item.id));

    if (type === LinkType.PUBLIC) {
      this.linksPublic = links
      return this.handlePostsPublic(linksRunning)
    }
    else {
      this.linksPrivate = links
      return this.handlePostsPrivate(linksRunning)
    }
  }

  async processLinkPublic1(link: LinkEntity) {
    if (!link.postIdV1) {
      const runThread = async (threadOrder: number) => {
        while (true) {
          const linkRuning = this.linksPublic.find(item => item.id === link.id)// check còn nằm trong link
          if (!linkRuning) { break };
          if (threadOrder > linkRuning.thread) { break };

          try {
            let dataComment = await this.facebookService.getCmtPublic(link.postId, link)
            if (!dataComment?.commentId || !dataComment?.userIdComment) continue
            this.addQueueComment(dataComment, link)

          } catch (error) {
            console.log(`Crawl comment with postId ${link.postId} Error.`, error?.message)
          } finally {

            if (link.delayTime) {
              await delay((linkRuning.delayTime) * 1000)
            }
          }
        }
      }

      for (let threadOrder = 1; threadOrder <= link.thread; threadOrder++) {
        runThread(threadOrder);
      }
    }
  }

  async processLinkPublic2(link: LinkEntity) {
    if (link.postIdV1) {
      const runThread = async (threadOrder: number) => {
        while (true) {
          const linkRuning = this.linksPublic.find(item => item.id === link.id)
          if (!linkRuning) { break };
          if (threadOrder > linkRuning.thread) { break };
          try {
            let dataComment = await this.facebookService.getCmtPublic(link.postIdV1, link) || {} as any
            console.log("🚀 ~ MonitoringService ~ runThread ~ dataComment:", dataComment)
            if (!dataComment?.commentId || !dataComment?.userIdComment) continue
            this.addQueueComment(dataComment, link)

          } catch (error) {
            console.log(`Crawl comment with postId ${link.postId} Error.`, error?.message)
          } finally {
            if (link.delayTime) {
              await delay((linkRuning.delayTime) * 1000)
            }
          }

        }
      }
      for (let threadOrder = 1; threadOrder <= link.thread; threadOrder++) {
        runThread(threadOrder);
      }
    }
  }

  async handlePostsPublic(linksRunning: LinkEntity[]) {
    const postHandle = linksRunning.map((link) => {
      return this.processLinkPublic1(link)
    })
    const postHandleV1 = linksRunning.map((link) => {
      return this.processLinkPublic2(link)
    })

    return Promise.all([...postHandle, ...postHandleV1])
  }

  async processLinkPrivate(link: LinkEntity) {
    const runThread = async (threadOrder: number) => {
      while (true) {
        const linkRuning = this.linksPrivate.find(item => item.id === link.id)
        if (!linkRuning) { break };
        if (threadOrder > linkRuning.thread) { break };

        try {
          const dataComment = await this.facebookService.getCommentByToken(link.postId, link.postIdV1)
          if (!dataComment?.commentId || !dataComment?.userIdComment) continue
          this.addQueueComment(dataComment, link)
        } catch (error) {
          console.log(`Crawl comment with postId ${link.postId} Error.`, error?.message)
        } finally {
          if (link.delayTime) {
            await delay((linkRuning.delayTime) * 1000)
          }
        }
      }
    }
    for (let threadOrder = 1; threadOrder <= link.thread; threadOrder++) {
      runThread(threadOrder);
    }

  }

  async handlePostsPrivate(linksRunning: LinkEntity[]) {
    const postHandle = linksRunning.map((link) => {
      return this.processLinkPrivate(link)
    })

    return Promise.all(postHandle)
  }

  async getDelayTime(status: LinkStatus, type: LinkType, delayOnPrivateUser: number) {
    const setting = await this.delayRepository.find()

    if (status === LinkStatus.Started && type === LinkType.PRIVATE) {
      return delayOnPrivateUser
    }

    if (status === LinkStatus.Pending && type === LinkType.PRIVATE) {
      return setting[0].delayOffPrivate
    }

    if (status === LinkStatus.Started && type === LinkType.PUBLIC) {
      return setting[0].delayOnPublic
    }

    if (status === LinkStatus.Pending && type === LinkType.PUBLIC) {
      return setting[0].delayOff
    }
  }

  async addQueueComment(resComment: ICommentResponse, link: LinkEntity) {
    return this.consumer.run(link, resComment)
  }
}
