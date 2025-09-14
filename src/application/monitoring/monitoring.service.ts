import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import { delay, groupPostsByType } from 'src/common/utils/helper';
import { FacebookService } from '../facebook/facebook.service';
import { ICommentResponse } from '../facebook/facebook.service.i';
import {
  LinkEntity,
  LinkType
} from '../links/entities/links.entity';
import { LinkService } from '../links/links.service';
import { MonitoringConsumer } from './monitoring.process';
import { Cron, CronExpression } from '@nestjs/schedule';
const proxy_check = require('proxy-check');

dayjs.extend(utc);

type RefreshKey = 'refreshToken' | 'refreshCookie' | 'refreshProxy';
@Injectable()
export class MonitoringService {
  linkIdsReceive: number[] = []
  postIdRunning: string[] = []
  linksPublic: LinkEntity[] = []
  linksPrivate: LinkEntity[] = []
  isHandleUrl: boolean = false
  isReHandleUrl: boolean = false
  isHandleUuid: boolean = false
  isCheckProxy: boolean = false
  isUpdatePostIdV1: boolean = false
  linkPublicCheckSpeed: LinkEntity | null = null
  speed = 0

  constructor(
    private readonly facebookService: FacebookService,
    private linkService: LinkService,
    private consumer: MonitoringConsumer
  ) { }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async startMonitoring() {
    const postsStarted = await this.linkService.getPostStarted(this.linkIdsReceive)
    console.log("🚀 ~ MonitoringService ~ startMonitoring ~ postsStarted:", postsStarted.length)
    this.linkPublicCheckSpeed = postsStarted.find(item => item.postIdV1)
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
          const start = Date.now();
          const linkRuning = this.linksPublic.find(item => item.id === link.id)
          if (!linkRuning) { break };
          if (threadOrder > linkRuning.thread) { break };

          try {
            let dataComment = await this.facebookService.getCmtPublic(link.postIdV1, link) || {} as any
            if (!dataComment?.commentId || !dataComment?.userIdComment) continue
            this.addQueueComment(dataComment, link)

          } catch (error) {
            console.log(`Crawl comment with postId ${link.postId} Error.`, error?.message)
          } finally {
            const end = Date.now();
            const duration = (end - start) / 1000;
            // console.log(duration)
            this.speed = duration
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
          const dataComment = await this.facebookService.getCommentByToken(link.id, link.postId, link.postIdV1,)
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

  async addQueueComment(resComment: ICommentResponse, link: LinkEntity) {
    return this.consumer.run(link, resComment)
  }
}
