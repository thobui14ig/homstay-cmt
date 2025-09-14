import { Module } from '@nestjs/common';
import { HealthCheckController } from './health-check.controler';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
    imports: [MonitoringModule],
    controllers: [HealthCheckController],
    providers: [],
    exports: []
})
export class HealthCheckModule { }
