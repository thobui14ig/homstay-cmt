import { Module } from '@nestjs/common';
import { SettingService } from './setting.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KeywordEntity } from '../../domain/entity/keyword';
import { DelayEntity } from '../../domain/entity/delay.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KeywordEntity, DelayEntity])],

  controllers: [],
  providers: [SettingService],
  exports: [SettingService]
})
export class SettingModule { }
