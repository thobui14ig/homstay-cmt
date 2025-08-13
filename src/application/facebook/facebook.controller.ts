import { Body, Controller, Post, Req } from "@nestjs/common";
import { FacebookService } from "./facebook.service";
import { CommentEntity } from "../../domain/entity/comment.entity";

@Controller('facebook')
export class FacebookController {
    constructor(private readonly facebookService: FacebookService) { }

    @Post('/hide-cmt')
    hideCmt(@Body() body: CommentEntity) {
        // return this.facebookService.hideCmt([body])
    }
}