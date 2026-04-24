import { Injectable } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';
import { ConstantsService } from '../constants/constants.service';
import { LoggerService } from '../logger.service';
import { ApiService } from '../api/api.service';
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
  private readonly apiKey: string;
  private readonly auth: GoogleAuth | null = null;

  constructor(
    private readonly constantsService: ConstantsService,
    private readonly loggerService: LoggerService,
    private readonly apiService: ApiService,
  ) {
    this.apiKey = this.constantsService.private.GOOGLE_MAPS_API;
    const serviceJson = this.constantsService.private.GOOGLE_SERVICE_JSON;
    if (serviceJson) {
      try {
        const credentials = JSON.parse(serviceJson);
        this.auth = new GoogleAuth({
          credentials,
          scopes: [this.constantsService.private.GOOGLE_MAPS_AUTH_SCOPE],
        });
      } catch (e) {
        this.loggerService.error({ error: e });
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
        this.loggerService.error({ error: e });
      }
    }
    return { 'X-Goog-Api-Key': this.apiKey };
  }

  private async callApi<T = any>(config: AxiosRequestConfig): Promise<T> {
    const authHeader = await this.getAuthHeader();
    const response = await this.apiService.request<T>({
      ...config,
      headers: { ...authHeader, ...config.headers },
    });
    return response.data;
  }

  async searchPlaces(query: string): Promise<PlaceSuggestion[]> {
    if (!this.apiKey && !this.auth) return [];
    try {
      const data = await this.callApi<{ places?: any[] }>({
        method: 'POST',
        url: `${this.constantsService.private.GOOGLE_MAPS_BASE_URL}:searchText`,
        data: { textQuery: query, includedType: 'lodging' },
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-FieldMask': this.constantsService.private.GOOGLE_MAPS_SEARCH_FIELD_MASK,
        },
      });
      return (data.places || []).map((p: any) => ({
        id: p.id,
        name: p.displayName?.text,
        address: p.formattedAddress,
      }));
    } catch (error) {
      this.loggerService.error({ error });
      return [];
    }
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    if (!this.apiKey && !this.auth) return null;
    try {
      const p = await this.callApi<any>({
        method: 'GET',
        url: `${this.constantsService.private.GOOGLE_MAPS_BASE_URL}/${placeId}`,
        headers: {
          'X-Goog-FieldMask': this.constantsService.private.GOOGLE_MAPS_DETAILS_FIELD_MASK,
        },
      });
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
      this.loggerService.error({ error });
      return null;
    }
  }
}
