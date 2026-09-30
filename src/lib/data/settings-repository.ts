import {
	userExportSchema,
	userSettingsSchema,
	type UpdateSettingsInput
} from '../contracts/settings';
import type { SettingsRepository } from './repositories';
import { callRpc, type RpcTransport } from './rpc-client';
import { RPC } from './rpc-names';

export class RpcSettingsRepository implements SettingsRepository {
	constructor(private readonly transport: RpcTransport) {}

	get() {
		return callRpc(this.transport, RPC.getUserSettings, {}, userSettingsSchema);
	}

	update(input: UpdateSettingsInput) {
		return callRpc(
			this.transport,
			RPC.updateUserSettings,
			{
				p_display_name: input.displayName ?? null,
				p_shelf_mode: input.shelfMode ?? null,
				p_motion_preference: input.motionPreference ?? null
			},
			userSettingsSchema
		);
	}

	exportData() {
		return callRpc(this.transport, RPC.exportUserData, {}, userExportSchema);
	}
}
