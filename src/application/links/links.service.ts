import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import * as timezone from 'dayjs/plugin/timezone';
import * as utc from 'dayjs/plugin/utc';
import { DataSource, In, IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { HideBy, LinkEntity, LinkStatus, LinkType } from '../../domain/entity/links.entity';
import { LEVEL } from '../../domain/entity/user.entity';
import { ISettingLinkDto } from './links.service.i';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class LinkService {
  ukTimezone = 'Asia/Ho_Chi_Minh';
  constructor(
    @InjectRepository(LinkEntity)
    private repo: Repository<LinkEntity>,
    private conenction: DataSource
  ) { }

  getOne(id: number) {
    return this.repo.findOne({
      where: {
        id,
      },
    });
  }

  async hideCmt(linkId: number, type: HideBy, userId: number) {
    const link = await this.repo.findOne({
      where: {
        id: linkId
      }
    })
    if (link) {
      link.hideBy = type
      return this.repo.save(link)
    }

    return null
  }

  getkeywordsByLink(linkId: number) {
    return this.repo.findOne({
      where: {
        id: linkId
      },
      relations: {
        keywords: true
      }
    })
  }

  async settingLink(setting: ISettingLinkDto) {
    if (setting.isDelete) {
      return this.repo.delete(setting.linkIds)
    }

    const links = await this.repo.find({
      where: {
        id: In(setting.linkIds)
      }
    })

    const newLinks = links.map((item) => {
      if (setting.onOff) {
        item.status = LinkStatus.Started
      } else {
        item.status = LinkStatus.Pending
      }

      if (setting.delay) {
        item.delayTime = setting.delay
      }

      return item
    })

    return this.repo.save(newLinks)
  }

  async updateLinkPostIdInvalid(postId: string) {
    const links = await this.repo.find({
      where: {
        postId,
      }
    })

    return this.repo.save(links.map((item) => {
      return {
        ...item,
        errorMessage: `Link die`,
        type: LinkType.DIE
      }
    }))
  }

  getLinkOrtherId(postId: string) {
    return this.repo.findOne({
      where: {
        postId: Not(postId),
        type: LinkType.PRIVATE
      }
    })
  }

  updateType(link: LinkEntity) {
    return this.repo.save(link)
  }

  getLinksWithoutProfile() {
    return this.repo.find({
      where: {
        process: false,
        postId: IsNull()
      },
      relations: {
        user: true
      }
    })
  }

  getPostStarted(): Promise<LinkEntity[]> {
    return this.repo.find({
      where: {
        status: In([LinkStatus.Started, LinkStatus.Pending]),
        type: Not(LinkType.DIE),
        delayTime: MoreThanOrEqual(0),
        hideCmt: false,
      },
      relations: {
        user: true
      }
    })
  }

  getAllLinkPublicPostIdV1Null() {
    return this.repo.find({
      where: {
        status: In([LinkStatus.Started, LinkStatus.Pending]),
        type: LinkType.PUBLIC,
        postIdV1: IsNull(),
      }
    })
  }

  processTotalComment(linkIds: number[]) {
    return this.conenction.query(`
      with k1 as(
	      select l.id as linkId, count(c.id) as totalComment from links l 
        join comments c 
        on c.link_id = l.id
       where l.id in(?)
        group by l.id  
      )
      update links l 
      join k1 on k1.linkId = l.id
      set 
      l.comment_count = k1.totalComment
    `, [linkIds])
  }
}
