
import { LinkType } from "../../domain/entity/links.entity";

export interface BodyLinkQuery {
    type: LinkType
    lastCommentFrom?: number
    lastCommentTo?: number
    differenceCountCmtFrom?: number
    differenceCountCmtTo?: number
    delayFrom?: number
    delayTo?: number
    likeFrom?: number
    likeTo?: number
    userId: number
}

export interface ISettingLinkDto {
    isDelete: boolean
    onOff: boolean
    delay: number
    linkIds: number[]
}