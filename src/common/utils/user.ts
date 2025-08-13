import { Request } from 'express';
import { UserEntity } from 'src/domain/entity/user.entity';

export const getUser = (req: Request): UserEntity => {
  return req['user'];
};
