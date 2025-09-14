import { LinkType } from "../links/entities/links.entity";

export interface IGetProfileLinkResponse {
    type: LinkType,
    name?: string,
    postId?: string,
}

export interface ICommentResponse {
    commentId: string,
    userNameComment: string,
    commentMessage: string,
    phoneNumber: string,
    userIdComment: string,
    commentCreatedAt: string,
}

export const FB_UUID = [
    {
        mail: "Beewisaka@gmail.com",
        key: "5f00db79-553d-4f3f-b1ba-af7a6faad5b6"
    },
    {
        mail: "chuongk57@gmail.com",
        key: "d383628f-0a52-4e84-ac28-4ae0b0716486"
    }
]
