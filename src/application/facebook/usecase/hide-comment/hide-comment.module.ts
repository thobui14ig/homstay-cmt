import { HttpModule } from "@nestjs/axios";
import { forwardRef, Module } from "@nestjs/common";
import { ProxyModule } from "src/application/proxy/proxy.module";
import { TokenModule } from "src/application/token/token.module";
import { HideCommentUseCase } from "./hide-comment";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CommentEntity } from "src/domain/entity/comment.entity";
import { CookieEntity } from "src/domain/entity/cookie.entity";
import { KeywordEntity } from "src/domain/entity/keyword";

@Module({
    imports: [HttpModule, ProxyModule, TokenModule, TypeOrmModule.forFeature([CommentEntity, CookieEntity])],
    controllers: [],
    providers: [HideCommentUseCase],
    exports: [HideCommentUseCase],
})
export class HideCommentUseCaseModule { }
