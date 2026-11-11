# Security: every API is secure

- Put `@UseGuards(JwtAuthGuard)` on the controller, and read the caller with `@CurrentAccount() account: Account`. Admin-only routes use `@AdminOnly()`. Role-based actions use `PERMISSIONS`.
- **Always verify ownership** in the service before reading or changing a record:
  ```ts
  private async findRoomForAccount(id: number, currentAccount: Account): Promise<Room> {
    const room = await this.roomsRepository.findByPk(id);
    if (!room) throw new NotFoundException();
    await this.hotelsService.findByIdForAccount(room.hotelId, currentAccount);
    return room;
  }
  ```
- The frontend's gating is cosmetic. Enforce the real check here regardless.
