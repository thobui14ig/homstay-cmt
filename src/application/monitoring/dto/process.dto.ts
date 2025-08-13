import { IsEnum, IsNumber } from 'class-validator';
import { LinkStatus } from 'src/domain/entity/links.entity';

export class ProcessDTO {
  @IsNumber()
  id: number;

  @IsEnum(LinkStatus)
  status: LinkStatus;
}
