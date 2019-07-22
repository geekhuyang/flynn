import { Data, DataAction } from './Data';

export enum ActionType {
	SET_DATA = 'SET_DATA',
	SUBMIT_DATA = 'SUBMIT_DATA'
}

interface SetDataAction {
	type: ActionType.SET_DATA;
	data: Data;
}

interface SubmitDataAction {
	type: ActionType.SUBMIT_DATA;
	data: Data;
}

export type Action = SetDataAction | SubmitDataAction | DataAction;
