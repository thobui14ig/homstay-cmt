import { LinkEntity } from 'src/domain/entity/links.entity';
import { UserEntity } from 'src/domain/entity/user.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

@Entity('comments')
export class CommentEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'post_id', type: 'varchar', length: 255 })
    postId: string;

    @Column({ name: 'user_id', type: 'int' })
    userId: number;

    @Column({ name: 'uid', type: 'varchar', length: 255, nullable: true })
    uid: string;

    @Column({ name: 'name', type: 'varchar', length: 255, nullable: true })
    name: string;

    @Column({ name: 'message', type: 'text', nullable: true })
    message: string;

    @Column({ name: 'time_created', nullable: true })
    timeCreated: Date;

    @Column({ name: 'phone_number', type: 'varchar', length: 255, nullable: true })
    phoneNumber: string;

    @Column({ name: 'cmtid', type: 'varchar', length: 255 })
    cmtId: string;

    @Column({ name: 'link_id', type: 'int' })
    linkId: number;

    @Column({ name: 'hide_cmt', type: 'boolean' })
    hideCmt: boolean;

    @ManyToOne(() => LinkEntity, (link) => link.comments)
    @JoinColumn({ name: 'link_id' })
    link: LinkEntity

    @ManyToOne(() => UserEntity, (user) => user.comments)
    @JoinColumn({ name: 'user_id' })
    user: UserEntity
}
