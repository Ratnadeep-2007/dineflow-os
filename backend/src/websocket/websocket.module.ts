import { Module, Global } from '@nestjs/common';
import { ReservationsGateway } from './reservations.gateway';

@Global()
@Module({
  providers: [ReservationsGateway],
  exports: [ReservationsGateway],
})
export class WebsocketModule {}
