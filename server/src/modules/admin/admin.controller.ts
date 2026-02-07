import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as sharp from 'sharp';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue overview data' })
  async getRevenueOverview() {
    return this.adminService.getRevenueOverview();
  }

  @Get('bets')
  @ApiOperation({ summary: 'Get all bets for admin management' })
  async getBets(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('categoryId') categoryId?: string,
    @Query('result') result?: string
  ) {
    const pageNum = parseInt(page || '1', 10) || 1;
    const limitNum = parseInt(limit || '50', 10) || 50;
    return this.adminService.getBets(pageNum, limitNum, categoryId, result);
  }

  @Post('bets')
  @ApiOperation({ summary: 'Create a new bet with image upload' })
  @ApiConsumes('multipart/form-data')
  async createBet(@Req() req: any, @CurrentUser() user: any) {
    // Log request info for debugging mobile issues
    console.log('=== CREATE BET REQUEST ===');
    console.log('User-Agent:', req.headers['user-agent']);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Content-Length:', req.headers['content-length']);
    
    const data = await this.parseMultipartRequest(req);
    console.log('Parsed data:', { ...data, imageUrl: data.imageUrl ? '[IMAGE_URL_SET]' : '[NO_IMAGE]' });
    
    return this.adminService.createBet({
      ...data,
      createdBy: user.id,
    });
  }

  @Put('bets/:id')
  @ApiOperation({ summary: 'Update a bet' })
  @ApiConsumes('multipart/form-data')
  async updateBet(@Param('id') id: string, @Req() req: any) {
    const data = await this.parseMultipartRequest(req);
    return this.adminService.updateBet(id, data);
  }

  @Delete('bets/:id')
  @ApiOperation({ summary: 'Delete a bet' })
  async deleteBet(@Param('id') id: string) {
    return this.adminService.deleteBet(id);
  }

  @Post('bets/:id/publish')
  @ApiOperation({ summary: 'Publish a bet' })
  async publishBet(@Param('id') id: string) {
    return this.adminService.publishBet(id);
  }

  @Put('bets/:id/result')
  @ApiOperation({ summary: 'Update bet result (WIN/LOST/CASH_OUT)' })
  async updateBetResult(@Param('id') id: string, @Body() data: { result: string }) {
    return this.adminService.updateBetResult(id, data.result);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Get all subscriptions' })
  async getSubscriptions() {
    return this.adminService.getSubscriptions();
  }

  @Post('subscriptions/:id/refund')
  @ApiOperation({ summary: 'Refund a subscription' })
  async refundSubscription(@Param('id') id: string) {
    return this.adminService.refundSubscription(id);
  }

  @Post('sync-free-packs')
  @ApiOperation({ summary: 'Sync all free packs to all verified users' })
  async syncFreePacks() {
    return this.adminService.syncFreePacks();
  }

  private async parseMultipartRequest(req: any): Promise<any> {
    const data: any = {};
    let imageUrl: string | null = null;

    // Check if this is a multipart request
    const contentType = req.headers['content-type'] || '';
    console.log('parseMultipartRequest - Content-Type:', contentType);
    
    if (!contentType.includes('multipart/form-data')) {
      console.log('Not multipart, checking body:', req.body ? 'has body' : 'no body');
      // Handle JSON body for non-multipart requests
      if (req.body) {
        return req.body;
      }
      return data;
    }

    let partCount = 0;
    
    try {
      // Use the file() method for single file upload or parts() for multiple
      console.log('Starting multipart parsing...');
      const parts = req.parts();
      
      for await (const part of parts) {
        partCount++;
        console.log(`Processing part ${partCount}: type=${part.type}, fieldname=${part.fieldname}`);
        
        if (part.type === 'file') {
          // Handle file upload
          if (part.fieldname === 'image' && part.filename) {
            const uploadsDir = join(process.cwd(), 'uploads', 'bets');
            if (!existsSync(uploadsDir)) {
              mkdirSync(uploadsDir, { recursive: true });
            }

            // Read the file buffer from stream
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);

            // Skip empty files
            if (buffer.length === 0) {
              console.log('Skipping empty file upload');
              continue;
            }

            console.log(`Processing image upload: ${part.filename}, size: ${buffer.length} bytes, mimetype: ${part.mimetype}`);

            // Determine the output extension based on input
            const inputExt = part.filename.toLowerCase().split('.').pop();
            const outputExt = (inputExt === 'png') ? 'png' : 'jpg';
            const filename = `bet-${uuidv4()}.${outputExt}`;
            const filepath = join(uploadsDir, filename);

            try {
              // Process image with sharp:
              // - Auto-rotate based on EXIF orientation (important for mobile photos!)
              // - Resize to max 1600x1200 while maintaining aspect ratio (high-DPI support)
              // - Optimize quality for sharpness
              const sharpInstance = sharp(buffer)
                .rotate() // Auto-rotate based on EXIF orientation - CRITICAL for mobile photos
                .resize(1600, 1200, {
                  fit: 'inside',
                  withoutEnlargement: true,
                });

              if (outputExt === 'png') {
                await sharpInstance.png({ quality: 90 }).toFile(filepath);
              } else {
                await sharpInstance.jpeg({ quality: 90 }).toFile(filepath);
              }

              imageUrl = `/uploads/bets/${filename}`;
              console.log(`Image saved successfully: ${imageUrl}`);
            } catch (sharpError: any) {
              console.error('Sharp image processing error:', sharpError.message);
              throw new BadRequestException(`Failed to process image: ${sharpError.message}`);
            }
          } else {
            // Consume the file stream even if we don't use it
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for await (const _ of part.file) {
              // drain the stream
            }
          }
        } else {
          // Handle field
          data[part.fieldname] = part.value;
        }
      }
    } catch (err: any) {
      console.error('Error processing multipart request:', err.message, err.stack);
      // If it's already a BadRequestException, re-throw it
      if (err instanceof BadRequestException) {
        throw err;
      }
      // If the error is about the stream being already consumed, use body
      if (req.body && Object.keys(req.body).length > 0) {
        return req.body;
      }
      throw new BadRequestException(`Failed to parse multipart request: ${err.message}`);
    }

    console.log(`Multipart parsing complete. Parts processed: ${partCount || 0}, Fields: ${Object.keys(data).join(', ')}, ImageUrl: ${imageUrl ? 'SET' : 'NOT SET'}`);
    
    if (imageUrl) {
      data.imageUrl = imageUrl;
    }

    return data;
  }
}
