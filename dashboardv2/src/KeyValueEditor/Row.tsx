import * as React from 'react';
import { Box } from 'grommet';

import { Entry } from './Data';
import { Input, InputSelection } from './Input';
import { StringValidator } from '../useStringValidation';

export interface Selection extends InputSelection {
	entryIndex: number;
	entryInnerIndex: 0 | 1; // key | val
}

export interface SuggestionValueTemplate extends InputSelection {
	value: string;
}

export interface Suggestion {
	key: string;
	validateValue: StringValidator;
	valueTemplate: SuggestionValueTemplate;
}

type EntryInnerIndex = 0 | 1;

export interface RowProps {
	index: number;
	entry: Entry;
	keyPlaceholder: string;
	valuePlaceholder: string;
	refHandler: (entryIndex: number, entryInnerIndex: EntryInnerIndex, ref: any) => void;
	onKeyChange: (entryIndex: number, key: string) => void;
	onValueChange: (entryIndex: number, value: string) => void;
	onBlur: (
		entryIndex: number,
		entryInnerIndex: EntryInnerIndex,
		e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>
	) => void;
	onSelectionChange: (entryIndex: number, entryInnerIndex: EntryInnerIndex, selection: InputSelection) => void;
	keyInputSuggestions: string[];
	onKeySuggestionSelect: (entryIndex: number, suggestion: string) => void;
	onPaste: (
		entryIndex: number,
		entryInnerIndex: number,
		event: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>
	) => void;
	selectedKeySuggestion: Suggestion | null;
}

function Row(props: RowProps) {
	const [key, value, { rebaseConflict, originalValue }] = props.entry;
	const hasConflict = rebaseConflict !== undefined;

	const {
		index,
		refHandler,
		onKeyChange,
		onValueChange,
		onBlur,
		onSelectionChange,
		onKeySuggestionSelect,
		onPaste
	} = props;

	const keyInputRefHandler = React.useCallback(
		(ref: any) => {
			refHandler(index, 0, ref);
		},
		[index, refHandler]
	);

	const keyChangeHandler = React.useCallback(
		(value: string) => {
			onKeyChange(index, value);
		},
		[index, onKeyChange]
	);

	const keyBlurHandler = React.useCallback(
		(e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			onBlur(index, 0, e);
		},
		[index, onBlur]
	);

	const keySelectionChangeHandler = React.useCallback(
		(selection: InputSelection) => {
			onSelectionChange(index, 0, selection);
		},
		[index, onSelectionChange]
	);

	const keySuggestionSelectionHandler = React.useCallback(
		(suggestion: string) => {
			onKeySuggestionSelect(index, suggestion);
		},
		[index, onKeySuggestionSelect]
	);

	const keyPasteHandler = React.useCallback(
		(e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			onPaste(index, 0, e);
		},
		[index, onPaste]
	);

	const valueInputRefHandler = React.useCallback(
		(ref: any) => {
			refHandler(index, 1, ref);
		},
		[index, refHandler]
	);

	const valueChangeHandler = React.useCallback(
		(value: string) => {
			onValueChange(index, value);
		},
		[index, onValueChange]
	);

	const valueBlurHandler = React.useCallback(
		(e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			onBlur(index, 1, e);
		},
		[index, onBlur]
	);

	const valueSelectionChangeHandler = React.useCallback(
		(selection: InputSelection) => {
			onSelectionChange(index, 1, selection);
		},
		[index, onSelectionChange]
	);

	const valuePasteHandler = React.useCallback(
		(e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			onPaste(index, 1, e);
		},
		[index, onPaste]
	);

	return (
		<>
			<Input
				refHandler={keyInputRefHandler}
				placeholder={props.keyPlaceholder}
				value={key}
				hasConflict={hasConflict}
				onChange={keyChangeHandler}
				onBlur={keyBlurHandler}
				onSelectionChange={keySelectionChangeHandler}
				suggestions={props.keyInputSuggestions}
				onSuggestionSelect={keySuggestionSelectionHandler}
				onPaste={keyPasteHandler}
			/>
			<Box flex="grow" justify="center">
				=
			</Box>
			<Input
				refHandler={valueInputRefHandler}
				placeholder={props.valuePlaceholder}
				value={value}
				validateValue={props.selectedKeySuggestion ? props.selectedKeySuggestion.validateValue : undefined}
				newValue={hasConflict ? originalValue : undefined}
				onChange={valueChangeHandler}
				onBlur={valueBlurHandler}
				onSelectionChange={valueSelectionChangeHandler}
				onPaste={valuePasteHandler}
			/>
		</>
	);
}
const RowMemo = React.memo(Row);
export { RowMemo as Row };

(Row as any).whyDidYouRender = true;
