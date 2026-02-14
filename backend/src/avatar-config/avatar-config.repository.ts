import { AvatarConfig } from './avatar-config.model';

export const AVATAR_CONFIG_REPOSITORY = 'AVATAR_CONFIG_REPOSITORY';

export const AvatarConfigRepository = {
    provide: AVATAR_CONFIG_REPOSITORY,
    useValue: AvatarConfig,
};
