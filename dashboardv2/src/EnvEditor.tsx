import * as React from 'react';
import * as jspb from 'google-protobuf';
import Loading from './Loading';
import CreateDeployment from './CreateDeployment';
import KeyValueEditor, {
	Data,
	dataReducer,
	DataActionType,
	Action as KVEditorAction,
	ActionType as KVEditorActionType,
	getEntries,
	buildData
} from './KeyValueEditor';
import protoMapDiff, { applyProtoMapDiff } from './util/protoMapDiff';
import protoMapReplace from './util/protoMapReplace';
import useErrorHandler from './useErrorHandler';
import { Release } from './generated/controller_pb';
import RightOverlay from './RightOverlay';
import { isNotFoundError } from './client';
import useAppRelease from './useAppRelease';
import useNavProtection from './useNavProtection';

interface Props {
	appName: string;
}

interface State {
	data: Data;
	isDeploying: boolean;
}

function initialState(props: Props): State {
	return {
		data: buildData([]),
		isDeploying: false
	};
}

enum ActionType {
	INIT_DATA = 'INIT_DATA',
	DEPLOY_DISMISS = 'DEPLOY_DISMISS',
	DEPLOY_SUCCESS = 'DEPLOY_SUCCESS'
}

interface InitDataAction {
	type: ActionType.INIT_DATA;
	data: Data;
}

interface DeployDismissAction {
	type: ActionType.DEPLOY_DISMISS;
}

interface DeploySuccessAction {
	type: ActionType.DEPLOY_SUCCESS;
}

type Action = InitDataAction | DeployDismissAction | DeploySuccessAction | KVEditorAction;

function reducer(prevState: State, action: Action): State {
	const nextState = Object.assign({}, prevState);
	switch (action.type) {
		case ActionType.INIT_DATA:
			nextState.data = action.data;
			break;
		case KVEditorActionType.SET_DATA:
			nextState.data = action.data;
			break;
		case KVEditorActionType.SUBMIT_DATA:
			nextState.data = action.data;
			nextState.isDeploying = true;
			break;
		case ActionType.DEPLOY_DISMISS:
			nextState.isDeploying = false;
			break;
		case ActionType.DEPLOY_SUCCESS:
			nextState.isDeploying = false;
			nextState.data = buildData([]);
			break;
		default:
			nextState.data = dataReducer(prevState.data, action);
	}
	return nextState;
}

export default function EnvEditor(props: Props) {
	const { appName } = props;
	const handleError = useErrorHandler();
	// Stream app release
	const { release: currentRelease, loading: releaseIsLoading, error: releaseError } = useAppRelease(appName);
	// handle app not having a release (useMemo so it uses the same value over
	// multiple renders so as not to over-trigger hooks depending on `release`)
	const initialRelease = React.useMemo(() => new Release(), []);
	const release = currentRelease || initialRelease;

	const [{ data, isDeploying }, dispatch] = React.useReducer(reducer, initialState(props));

	const [enableNavProtection, disableNavProtection] = useNavProtection();
	React.useEffect(
		() => {
			if (data && data.hasChanges) {
				enableNavProtection();
			} else {
				disableNavProtection();
			}
		},
		[data, disableNavProtection, enableNavProtection]
	);

	// newRelease is used to create a deployment
	const newRelease = React.useMemo(
		() => {
			if (!release) return new Release();
			const diff = data ? protoMapDiff(release.getEnvMap(), new jspb.Map(getEntries(data))) : [];
			const newRelease = new Release();
			newRelease.setArtifactsList(release.getArtifactsList());
			protoMapReplace(newRelease.getLabelsMap(), release.getLabelsMap());
			protoMapReplace(newRelease.getProcessesMap(), release.getProcessesMap());
			protoMapReplace(newRelease.getEnvMap(), applyProtoMapDiff(release.getEnvMap(), diff));
			return newRelease;
		},
		[release, data]
	);

	React.useEffect(
		() => {
			// handle any non-404 errors (not all apps have a release yet)
			if (releaseError && !isNotFoundError(releaseError)) {
				return handleError(releaseError);
			}

			// maintain any non-conflicting changes made when new release arrives
			if (!release || !release.getName()) return;
			dispatch({ type: DataActionType.REBASE, base: release.getEnvMap().toArray() });
		},
		[handleError, release, releaseError]
	);

	const handleDeployDismiss = React.useCallback(() => {
		dispatch({ type: ActionType.DEPLOY_DISMISS });
	}, []);

	const handleDeployComplete = React.useCallback(() => {
		dispatch({ type: ActionType.DEPLOY_SUCCESS });
	}, []);

	if (releaseIsLoading) {
		return <Loading />;
	}

	if (!release) throw new Error('<EnvEditor> Error: Unexpected lack of release');

	return (
		<>
			{isDeploying ? (
				<RightOverlay onClose={handleDeployDismiss}>
					<CreateDeployment
						appName={appName}
						newRelease={newRelease || new Release()}
						onCancel={handleDeployDismiss}
						onCreate={handleDeployComplete}
						handleError={handleError}
					/>
				</RightOverlay>
			) : null}
			<KeyValueEditor
				data={data || buildData(release.getEnvMap().toArray())}
				dispatch={dispatch}
				keyPlaceholder="ENV key"
				valuePlaceholder="ENV value"
				conflictsMessage="Some edited keys have been updated in the latest release"
			/>
		</>
	);
}
