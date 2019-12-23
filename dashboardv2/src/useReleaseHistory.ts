import * as React from 'react';
import useClient from './useClient';
import {
	RequestModifier,
	setNameFilters,
	setStreamUpdates,
	setStreamCreates,
	setPageToken,
	setPageSize,
	StreamReleaseHistoryResponse,
	ReleaseHistoryItem
} from './client';
import { StreamScalesRequest, StreamDeploymentsRequest } from './generated/controller_pb';

const emptyScaleReqModifiersArray = [] as RequestModifier<StreamScalesRequest>[];
const emptyDeploymentReqModifiersArray = [] as RequestModifier<StreamDeploymentsRequest>[];

class NextPageTokens {
	public scales: string;
	public deployments: string;

	constructor(scales: string, deployments: string) {
		this.scales = scales;
		this.deployments = deployments;
	}

	toString() {
		return this.scales + this.deployments;
	}
}

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
	const [nextPageToken, setNextPageToken] = React.useState<NextPageTokens | null>(null);
	const [nextPageLoading, setNextPageLoading] = React.useState<boolean>(false);
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

					// wait for both streams to have a response
					if (!res.isComplete()) return;

					setItems(res.getItemsList());
					setNextPageToken(new NextPageTokens(res.getScaleRequestsNextPageToken(), res.getDeploymentsNextPageToken()));
					setLoading(false);
					setError(null);
				},
				// scale request modifiers
				[setNameFilters(appName), setPageSize(50), setStreamUpdates(), setStreamCreates(), ...scaleReqModifiers],
				// deployment request modifiers
				[setNameFilters(appName), setPageSize(50), setStreamUpdates(), setStreamCreates(), ...deploymentReqModifiers]
			);
			return cancel;
		},
		[client, appName, scaleReqModifiers, deploymentReqModifiers, scalesEnabled, deploymentsEnabled]
	);

	const pagesMap = React.useMemo(() => new Map<NextPageTokens, ReleaseHistoryItem[]>(), []);
	const [pageOrder, setPageOrder] = React.useState<NextPageTokens[]>([]);

	const fetchNextPage = React.useCallback(
		(pageTokens) => {
			let cancel = () => {};

			if (pageTokens === null) return cancel;
			if (pagesMap.has(pageTokens)) return cancel;

			// initialize page so additional calls with the same token will be void
			// (see above).
			pagesMap.set(pageTokens, []);

			const scaleRequestsNextPageToken = pageTokens.scales;
			const deploymentsNextPageToken = pageTokens.deployments;

			setNextPageLoading(true);

			cancel = client.streamReleaseHistory(
				(res: StreamReleaseHistoryResponse, error: Error | null) => {
					if (error) {
						setError(error);
						setNextPageLoading(false);
						return;
					}

					// wait for both streams to have a response
					if (!res.isComplete()) return;

					setNextPageToken(new NextPageTokens(res.getScaleRequestsNextPageToken(), res.getDeploymentsNextPageToken()));

					pagesMap.set(pageTokens, res.getItemsList());
					const nextPageOrder = pageOrder.concat([pageTokens]);
					setPageOrder(nextPageOrder);

					setNextPageLoading(false);
				},
				// scale request modifiers
				scaleRequestsNextPageToken
					? [setNameFilters(appName), setPageToken(scaleRequestsNextPageToken), ...scaleReqModifiers]
					: null,
				// deployment request modifiers
				deploymentsNextPageToken
					? [setNameFilters(appName), setPageToken(deploymentsNextPageToken), ...deploymentReqModifiers]
					: null
			);
			return cancel;
		},
		[appName, client, deploymentReqModifiers, pageOrder, pagesMap, scaleReqModifiers]
	);

	const allItems = React.useMemo(
		() => {
			return items.concat(
				pageOrder.reduce((m: ReleaseHistoryItem[], pts: NextPageTokens) => {
					return m.concat(pagesMap.get(pts) || []);
				}, [])
			);
		},
		[items, pageOrder, pagesMap]
	);

	return {
		loading,
		items: allItems,
		nextPageToken,
		nextPageLoading,
		fetchNextPage,
		error
	};
}
