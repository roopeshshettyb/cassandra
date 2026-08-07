import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { parseConnectionHandshake } from '../chat/gateway/gateway-auth.helper';

interface NotificationSocket extends Socket {
  accountId?: number;
}

@WebSocketGateway({ cors: true, namespace: '/notifications' })
@Injectable()
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private accountConnections: Map<number, Set<NotificationSocket>> = new Map();

  constructor(private readonly authService: AuthService) {}

  async handleConnection(client: NotificationSocket) {
    const { token } = parseConnectionHandshake(client);
    if (!token) {
      client.emit('error', { message: 'Token required' });
      client.disconnect();
      return;
    }

    try {
      const account = await this.authService.verifyToken(token);
      if (!account) {
        client.emit('error', { message: 'Invalid token' });
        client.disconnect();
        return;
      }

      client.accountId = account.id;
      if (!this.accountConnections.has(account.id)) {
        this.accountConnections.set(account.id, new Set());
      }
      this.accountConnections.get(account.id).add(client);

      client.emit('connected', { message: 'Connected to notifications', accountId: account.id });
      this.logger.debug(`Account ${account.id} connected to notifications`);
    } catch (error) {
      this.logger.error(`Authentication failed: ${error.message}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: NotificationSocket) {
    if (client.accountId) {
      const accountSockets = this.accountConnections.get(client.accountId);
      if (accountSockets) {
        accountSockets.delete(client);
        if (accountSockets.size === 0) {
          this.accountConnections.delete(client.accountId);
        }
      }
      this.logger.debug(`Account ${client.accountId} disconnected from notifications`);
    }
  }

  @SubscribeMessage('ping')
  handlePing(client: NotificationSocket, payload: any) {
    return { event: 'pong', data: payload };
  }

  /**
   * Emit notification to a specific account
   */
  emitToAccount(accountId: number, notificationData: any) {
    const sockets = this.accountConnections.get(accountId);
    if (sockets && sockets.size > 0) {
      sockets.forEach((socket) => {
        socket.emit('notification', notificationData);
      });
    }
  }

  /**
   * Emit notification to multiple accounts
   */
  emitToAccounts(accountIds: number[], notificationData: any) {
    accountIds.forEach((accountId) => this.emitToAccount(accountId, notificationData));
  }
}
