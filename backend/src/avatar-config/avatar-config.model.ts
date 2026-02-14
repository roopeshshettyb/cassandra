import { Table, Model, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Hotel } from '../hotels/hotels.model';

@Table({ tableName: 'avatar_configs' })
export class AvatarConfig extends Model<AvatarConfig> {
    @Column({
        type: DataType.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    })
    id: number;

    @ForeignKey(() => Hotel)
    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        field: 'hotel_id',
        unique: 'avatar_configs_hotel_id_key', // One config per hotel
    })
    hotelId: number;

    @BelongsTo(() => Hotel)
    hotel: Hotel;

    @Column({
        type: DataType.STRING,
        allowNull: false,
        field: 'model_url',
        defaultValue: 'https://models.readyplayer.me/64b3c95e5d32b575743b817d.glb', // Default fallback
    })
    modelUrl: string;

    @Column({
        type: DataType.JSONB,
        allowNull: false,
        field: 'animation_paths',
        defaultValue: {
            idle: '/animations/idle.fbx',
            talking: '/animations/talking.fbx',
            waving: '/animations/waving.fbx',
            thinking: '/animations/thinking.fbx',
        },
    })
    animationPaths: Record<string, string>;

    @Column({
        type: DataType.STRING,
        allowNull: true,
        field: 'background_color', // Optional: Store user preference for grey shade
    })
    backgroundColor: string;
}
