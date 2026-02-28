import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PacksService, CreatePackDto, UpdatePackDto } from './packs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('packs')
@Controller('packs')
export class PacksController {
  constructor(private readonly packsService: PacksService) {}

  @Get()
  async getPacks(@Query('includeInactive') includeInactive?: string) {
    return this.packsService.getPacks(includeInactive === 'true');
  }

  @Get('paginated')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get packs with pagination (admin only)' })
  async getPacksPaginated(
    @Query('includeInactive') includeInactive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.packsService.getPacksPaginated(
      includeInactive === 'true',
      parseInt(page || '1', 10),
      parseInt(limit || '50', 10),
    );
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyPacks(@CurrentUser() user: any) {
    return this.packsService.getPacksForUser(user.sub || user.id);
  }

  @Get(':id')
  async getPackById(@Param('id') id: string) {
    return this.packsService.getPackById(id);
  }

  @Get(':id/categories')
  async getAllCategoriesForPack(@Param('id') id: string) {
    return this.packsService.getAllCategoriesForPack(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a pack (Admin only)' })
  async createPack(@Body() data: CreatePackDto) {
    return this.packsService.createPack(data);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a pack (Admin only)' })
  async updatePack(@Param('id') id: string, @Body() data: UpdatePackDto) {
    return this.packsService.updatePack(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a pack (Admin only)' })
  async deletePack(@Param('id') id: string) {
    await this.packsService.deletePack(id);
    return { message: 'Pack deleted successfully' };
  }

  @Post(':id/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Link categories to a pack (Admin only)' })
  async linkCategoriesToPack(
    @Param('id') id: string,
    @Body('categoryIds') categoryIds: string[]
  ) {
    await this.packsService.linkCategoriesToPack(id, categoryIds);
    return { message: 'Categories linked successfully' };
  }

  @Post(':id/hierarchy')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set pack hierarchy (Admin only)' })
  async setPackHierarchy(
    @Param('id') id: string,
    @Body('includedPackIds') includedPackIds: string[]
  ) {
    await this.packsService.setPackHierarchy(id, includedPackIds);
    return { message: 'Pack hierarchy updated successfully' };
  }
}

