import { Global, Module } from '@nestjs/common';
import { RedisModule as NestRedisModule, RedisModuleOptions } from '@nestjs-modules/ioredis';

import { RedisOptions } from 'ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SocketService } from './socket.service';

@Global()
@Module({
    imports: [],
    providers: [SocketService],
    exports: [SocketService],
})
export class SocketModule { }
