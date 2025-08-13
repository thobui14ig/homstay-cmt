import { Module } from '@nestjs/common';
import { LinkService } from './links.service';
import { LinkEntity } from '../../domain/entity/links.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DelayEntity } from '../../domain/entity/delay.entity';
import { CookieEntity } from '../../domain/entity/cookie.entity';
import { FacebookModule } from '../facebook/facebook.module';
import { CommentEntity } from '../../domain/entity/comment.entity';
import { KeywordEntity } from '../../domain/entity/keyword';

@Module({
  imports: [TypeOrmModule.forFeature([LinkEntity, DelayEntity, CookieEntity, CommentEntity, KeywordEntity]), FacebookModule],
  controllers: [],
  providers: [LinkService],
  exports: [LinkService],
})
export class LinkModule { }
