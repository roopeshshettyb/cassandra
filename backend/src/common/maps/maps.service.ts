import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConstantsService } from '../constants/constants.service';
import { GoogleAuth } from 'google-auth-library';

export interface PlaceSuggestion {
  id: string;
  name: string;
  address: string;
}

export interface PlaceDetails {
  id: string;
  name: string;
  address: string;
  website?: string;
  phoneNumber?: string;
  rating?: number;
  location: { lat: number; lng: number };
}

@Injectable()
export class MapsService {
  private readonly baseUrl = 'https://places.googleapis.com/v1/places';
  private readonly apiKey: string;
  private readonly auth: GoogleAuth | null = null;

  constructor(private readonly constantsService: ConstantsService) {
    this.apiKey = this.constantsService.private.GOOGLE_MAPS_API;
    const serviceJson = this.constantsService.private.GOOGLE_SERVICE_JSON;
    if (serviceJson) {
      try {
        const credentials = JSON.parse(serviceJson);
        this.auth = new GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
      } catch (e) {
        console.error('[MapsService] Failed to parse GOOGLE_SERVICE_JSON:', e.message);
      }
    }
  }

  private async getAuthHeader(): Promise<Record<string, string>> {
    if (this.auth) {
      try {
        const client = await this.auth.getClient();
        const tokenResponse = await client.getAccessToken();
        const token = tokenResponse?.token;
        if (token) return { Authorization: `Bearer ${token}` };
      } catch (e) {
        console.error('[MapsService] Failed to get service account token:', e.message);
      }
    }
    return { 'X-Goog-Api-Key': this.apiKey };
  }

  async searchPlaces(query: string): Promise<PlaceSuggestion[]> {
    if (!this.apiKey && !this.auth) return [];
    try {
      const authHeader = await this.getAuthHeader();
      const response = await axios.post(
        `${this.baseUrl}:searchText`,
        { textQuery: query },
        {
          headers: {
            'Content-Type': 'application/json',
            ...authHeader,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
          },
        },
      );
      return (response.data.places || []).map((p: any) => ({
        id: p.id,
        name: p.displayName?.text,
        address: p.formattedAddress,
      }));
    } catch (error) {
      console.error('Google Maps Search Error:', error.response?.data || error.message);
      return [];
    }
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    if (!this.apiKey && !this.auth) return null;
    try {
      const authHeader = await this.getAuthHeader();
      const response = await axios.get(`${this.baseUrl}/${placeId}`, {
        headers: {
          ...authHeader,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,websiteUri,nationalPhoneNumber,rating,location',
        },
      });
      const p = response.data;
      return {
        id: p.id,
        name: p.displayName?.text,
        address: p.formattedAddress,
        website: p.websiteUri,
        phoneNumber: p.nationalPhoneNumber,
        rating: p.rating,
        location: { lat: p.location?.latitude, lng: p.location?.longitude },
      };
    } catch (error) {
      console.error('Google Maps Details Error:', error.response?.data || error.message);
      return null;
    }
  }
}
