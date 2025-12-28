import { Controller, Post, Get, Body, Param, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import * as crypto from 'crypto';

// Stockage temporaire en mémoire (en production, utiliser Redis ou une base de données)
const sharedDataStore = new Map<string, { data: any; expiresAt: number }>();

// Nettoyer les données expirées toutes les heures
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of sharedDataStore.entries()) {
    if (value.expiresAt < now) {
      sharedDataStore.delete(key);
    }
  }
}, 60 * 60 * 1000); // 1 heure

@ApiTags('Shared Data')
@Controller('shared')
export class SharedDataController {
  /**
   * Créer un lien public partageable pour des données JSON
   */
  @Post('data')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer un lien public partageable pour des données JSON' })
  async createSharedData(@Body() body: { data: any; expiresInHours?: number }) {
    // Générer un token unique
    const token = this.generateToken();
    
    // Durée de vie par défaut : 7 jours
    const expiresInHours = body.expiresInHours || 24 * 7;
    const expiresAt = Date.now() + (expiresInHours * 60 * 60 * 1000);
    
    // Stocker les données
    sharedDataStore.set(token, {
      data: body.data,
      expiresAt,
    });
    
    // Retourner le lien public
    // Utiliser l'URL du backend pour l'endpoint public
    const apiUrl = process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:3001';
    const publicUrl = `${apiUrl}/shared/data/${token}`;
    
    return {
      success: true,
      token,
      publicUrl,
      expiresAt: new Date(expiresAt).toISOString(),
      expiresInHours,
    };
  }

  /**
   * Récupérer les données partagées (public, sans authentification)
   */
  @Get('data/:token')
  @Public()
  @ApiOperation({ summary: 'Récupérer des données partagées via un token public' })
  async getSharedData(@Param('token') token: string) {
    const stored = sharedDataStore.get(token);
    
    if (!stored) {
      throw new NotFoundException('Données non trouvées ou expirées');
    }
    
    if (stored.expiresAt < Date.now()) {
      sharedDataStore.delete(token);
      throw new NotFoundException('Données expirées');
    }
    
    return stored.data;
  }

  /**
   * Génère un token unique
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

