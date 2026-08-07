import { Injectable } from '@nestjs/common';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { URLSearchParams } from 'url';

@Injectable()
export class ApiService {
  async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      if (config.headers?.['Content-Type'] === 'application/x-www-form-urlencoded' && config.data) {
        config.data = new URLSearchParams(config.data).toString();
      }
      return await axios.request<T>(config);
    } catch (error) {
      if (error.response) {
        throw new Error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }
}

