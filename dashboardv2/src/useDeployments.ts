import * as React from 'react';
import useClient from './useClient';
import { RequestModifier, setStreamUpdates, setStreamCreates } from './client';
import { ExpandedDeployment, StreamDeploymentsRequest, StreamDeploymentsResponse } from './generated/controller_pb';

const emptyReqModifiersArray = [] as RequestModifier<StreamDeploymentsRequest>[];

export default function useDeployments(
	reqModifiers: RequestModifier<StreamDeploymentsRequest>[],
	enabled: boolean = false
) {
	const client = useClient();
	const [loading, setLoading] = React.useState(enabled);
	const [deployments, setDeployments] = React.useState<ExpandedDeployment[]>([]);
	const [error, setError] = React.useState<Error | null>(null);
	const [nextPageToken, setNextPageToken] = React.useState('');
	if (reqModifiers.length === 0) {
		reqModifiers = emptyReqModifiersArray;
	}
	React.useEffect(
		() => {
			if (!enabled) {
				return;
			}

			const cancel = client.streamDeployments(
				(res: StreamDeploymentsResponse, error: Error | null) => {
					if (error) {
						setError(error);
						return;
					}
					setDeployments(res.getDeploymentsList());
					setNextPageToken(res.getNextPageToken());
					setLoading(false);
					setError(null);
				},
				setStreamUpdates(),
				setStreamCreates(),
				...reqModifiers
			);
			return cancel;
		},
		[enabled, client, reqModifiers]
	);
	return {
		loading,
		deployments,
		nextPageToken,
		error
	};
}
