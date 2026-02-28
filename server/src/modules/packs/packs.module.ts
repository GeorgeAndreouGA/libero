import { Module } from '@nestjs/common';
import { PacksController } from './packs.controller';
import { PacksService } from './packs.service';
import { DatabaseModule } from '../../common/database/database.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [DatabaseModule, CategoriesModule],
  controllers: [PacksController],
  providers: [PacksService],
  exports: [PacksService],
})
export class PacksModule {}

