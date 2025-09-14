import { Controller, Get } from '@nestjs/common';
import { MonitoringService } from '../monitoring/monitoring.service';

@Controller('health-check')
export class HealthCheckController {
    constructor(private monitoringService: MonitoringService) { }

    @Get()
    healthCheck() {
        return {
            status: true,
            speed: this.monitoringService.speed
        }
    }
}
