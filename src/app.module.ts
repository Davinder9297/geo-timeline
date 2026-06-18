import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GeoTrackingModule } from './geo-tracking/geo-tracking.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot('mongodb://localhost/geo-timeline'),
    GeoTrackingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
