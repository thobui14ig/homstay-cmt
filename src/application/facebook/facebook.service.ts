import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import { firstValueFrom } from 'rxjs';
import { isNumeric } from 'src/common/utils/check-utils';
import { DataSource } from 'typeorm';
import { CommentsService } from '../comments/comments.service';
import { LinkEntity } from '../links/entities/links.entity';
import { ProxyEntity } from '../proxy/entities/proxy.entity';
import { FB_UUID } from './facebook.service.i';
import { CheckProxyBlockUseCase } from './usecase/check-proxy-block/check-proxy-block-usecase';
import { GetCommentPrivateUseCase } from './usecase/get-comment-private/get-comment-private';
import { GetCommentPublicUseCase } from './usecase/get-comment-public/get-comment-public';

dayjs.extend(utc);
// dayjs.extend(timezone);

@Injectable()
export class FacebookService {
  // appId = '256002347743983';
  appId = '6628568379'
  fbUrl = 'https://www.facebook.com';
  fbGraphql = `https://www.facebook.com/api/graphql`;
  ukTimezone = 'Asia/Bangkok';
  browser = null

  constructor(private readonly httpService: HttpService,
    private getCommentPublicUseCase: GetCommentPublicUseCase,
    private getCommentPrivateUseCase: GetCommentPrivateUseCase,
    private CheckProxyBlockUseCase: CheckProxyBlockUseCase,
    private commentsService: CommentsService,
    private connection: DataSource
  ) {
  }

  async getCmtPublic(postIdStr: string, link: LinkEntity) {
    const commentsRes = await this.getCommentPublicUseCase.getCmtPublic(postIdStr, false, link)
    if (!commentsRes) {//hết proxy or token
      return null
    }

    return commentsRes.data
  }

  async getCommentByToken(linkId: number, postId: string, postIdV1?: string,) {
    const commentsRes = await this.getCommentPrivateUseCase.getCommentPrivate(linkId, postId, postIdV1,)
    if (!commentsRes) {//hết proxy or token
      return null
    }

    return commentsRes.data
  }

  async checkProxyBlock(proxy: ProxyEntity) {
    return this.CheckProxyBlockUseCase.execute(proxy)
  }

  async getPhoneNumber(uid: string, commentId: string, accountFbUuid: string) {
    if (!isNumeric(uid)) return null
    const dataPhoneDb = await this.commentsService.getPhoneNumber(uid)
    if (dataPhoneDb?.phoneNumber) return dataPhoneDb.phoneNumber
    const account = FB_UUID.find(item => item.mail === accountFbUuid)
    if (!account) return null
    const body = {
      key: account.key,
      uids: [String(uid)]
    }
    const response = await firstValueFrom(
      this.httpService.post("https://api.fbuid.com/keys/convert", body,),
    );
    const dataPhone = response?.data?.find(item => item.uid == uid)
    const logs = {
      body,
      response: response.data
    }
    await this.insertLogs(uid, commentId, JSON.stringify(logs))

    return dataPhone?.phone ?? null
  }

  async addPhone(UID: string, Phone: string) {
    try {
      const body = {
        UID,
        Phone
      }
      return await firstValueFrom(
        this.httpService.post("https://api.fbuid.com/conversions/import", body,),
      );
    } catch (error) { }
  }

  insertLogs(UID: string, commentId: string, params: string) {
    return this.connection.query(`
      INSERT INTO logs (uid, cmt_id, params)
      VALUES ('${UID}', '${commentId}', '${params}');  
    `)
  }
}
