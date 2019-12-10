import * as React from 'react';
import useClient from './useClient';
import {
	RequestModifier,
	setNameFilters,
	setStreamUpdates,
	setStreamCreates,
	StreamReleaseHistoryResponse,
	ReleaseHistoryItem
} from './client';
import { StreamScalesRequest, StreamDeploymentsRequest } from './generated/controller_pb';

const emptyScaleReqModifiersArray = [] as RequestModifier<StreamScalesRequest>[];
const emptyDeploymentReqModifiersArray = [] as RequestModifier<StreamDeploymentsRequest>[];

export default function useReleaseHistory(
	appName: string,
	scaleReqModifiers: RequestModifier<StreamScalesRequest>[],
	deploymentReqModifiers: RequestModifier<StreamDeploymentsRequest>[],
	scalesEnabled: boolean = false,
	deploymentsEnabled: boolean = false
) {
	const client = useClient();
	const [loading, setLoading] = React.useState(scalesEnabled || deploymentsEnabled);
	const [items, setItems] = React.useState<ReleaseHistoryItem[]>([]);
	const [error, setError] = React.useState<Error | null>(null);
	const [nextPageToken, setNextPageToken] = React.useState('');
	if (scaleReqModifiers.length === 0) {
		scaleReqModifiers = emptyScaleReqModifiersArray;
	}
	if (deploymentReqModifiers.length === 0) {
		deploymentReqModifiers = emptyDeploymentReqModifiersArray;
	}
	React.useEffect(
		() => {
			if (!scalesEnabled && !deploymentsEnabled) {
				return;
			}

			const cancel = client.streamReleaseHistory(
				(res: StreamReleaseHistoryResponse, error: Error | null) => {
					if (error) {
						setError(error);
						return;
					}
					setItems(res.getItemsList());
					setNextPageToken(res.getNextPageToken());
					setLoading(false);
					setError(null);
				},
				// scale request modifiers
				[setNameFilters(appName), setStreamUpdates(), setStreamCreates(), ...scaleReqModifiers],
				// deployment request modifiers
				[setStreamUpdates(), setStreamCreates(), ...deploymentReqModifiers]
			);
			return cancel;
		},
		[client, appName, scaleReqModifiers, deploymentReqModifiers, scalesEnabled, deploymentsEnabled]
	);
	return {
		loading,
		items,
		nextPageToken,
		error
	};
}
