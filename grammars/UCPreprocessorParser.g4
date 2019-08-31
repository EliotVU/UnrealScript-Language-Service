parser grammar UCPreprocessorParser;

options {
	tokenVocab = UCLexer;
}

@parser::members {
	static globalSymbols = new Map<string, any>();

	currentState: boolean[] = [true];
	currentSymbols = new Map<string, any>();

	filePath: string;

	getSymbolValue(symbolName: string): any {
		return this.currentSymbols.get(symbolName) || UCPreprocessorParser.globalSymbols.get(symbolName);
	}

	getCurrentState(): boolean {
		return this.currentState.length === 0 || this.currentState.every(c => c === true);
	}

	peekCurrentState(): boolean {
		return this.currentState.length === 0 || this.currentState[this.currentState.length - 1];
	}
}

macros: (MACRO_CHAR macro)* EOF;

callArguments: OPEN_PARENS (MACRO_SYMBOL (',' MACRO_SYMBOL)*)? CLOSE_PARENS;

macro returns[isActive: boolean]
	: MACRO_DEFINE MACRO_SYMBOL (args=callArguments)? MACRO_TEXT? macroNewline
	{
		$isActive = this.getCurrentState();
		if ($isActive) {
			const symbolToken = $MACRO_SYMBOL;
			const id = symbolToken && symbolToken.text;
			if (id) {
				let text = $MACRO_TEXT.text;
				this.currentSymbols.set(id.toLowerCase(), text || '...');
			}
		}
	} # macroDefine
	| MACRO_UNDEFINE MACRO_SYMBOL macroNewline
	{
		$isActive = this.getCurrentState();
		if ($isActive) {
			const symbolToken = $MACRO_SYMBOL;
			const id = symbolToken && symbolToken.text;
			if (id) {
				this.currentSymbols.delete(id.toLowerCase());
			}
		}
	} # macroUndefine
	| KW_IF OPEN_PARENS expr=macroExpression CLOSE_PARENS macroNewline
	{
		$isActive = !!$expr.value && this.getCurrentState();
		this.currentState.push($isActive);
	} # macroIf
	| MACRO_ELSE_IF OPEN_PARENS expr=macroExpression CLOSE_PARENS macroNewline
	{
		if (!this.peekCurrentState()) {
			const isActive = !!$expr.value;
		  	this.currentState.pop();
	     	this.currentState.push(isActive);

		  	$isActive = isActive && this.getCurrentState();
		 } else {
			this.currentState.pop();
			this.currentState.push(false);
			$isActive = false;
		}
	} # macroElseIf
	| KW_ELSE macroNewline
	{
		if (!this.peekCurrentState()) {
			$isActive = this.getCurrentState();
			this.currentState.pop();
			this.currentState.push(true);
		} else {
			this.currentState.pop();
			this.currentState.push(false);
			$isActive = false;
		}
	} # macroElse
	| MACRO_END_IF macroNewline
	{
		this.currentState.pop();
		$isActive = this.peekCurrentState();
	} #macroEndIf
	| MACRO_INCLUDE macroNewline
	{
		$isActive = this.getCurrentState();
	} #macroInclude
	| OPEN_BRACE expr=macroExpression CLOSE_BRACE
	{
		$isActive = this.getCurrentState();
	} # macroCall
	| expr=macroExpression
	{
		$isActive = this.getCurrentState();
	} # macroCall
	;

macroNewline: MACRO_NEW_LINE | EOF;

macroExpression returns[value: boolean | string]
	: MACRO_CHAR MACRO_IS_DEFINED (OPEN_PARENS MACRO_SYMBOL? CLOSE_PARENS)
	{
		var id = $MACRO_SYMBOL.text;
		$value = id ? this.getSymbolValue(id.toLowerCase()) : false;
	}
	| MACRO_CHAR MACRO_NOT_DEFINED (OPEN_PARENS MACRO_SYMBOL? CLOSE_PARENS)
	{
		var id = $MACRO_SYMBOL.text;
		$value = id ? !this.getSymbolValue(id.toLowerCase()) : true;
	}
	| MACRO_LINE
	{
		$value = (this.currentToken.line - 1).toString();
	}
	| MACRO_FILE
	{
		$value = '"' + this.filePath + '"';
	}
	| MACRO_SYMBOL callArguments?
	{
		var symbolToken = $MACRO_SYMBOL;
		var id = symbolToken && symbolToken.text;
		$value = id && this.getSymbolValue(id.toLowerCase()) || false;
	}
	;