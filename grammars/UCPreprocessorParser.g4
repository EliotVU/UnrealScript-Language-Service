parser grammar UCPreprocessorParser;

options {
	tokenVocab = UCLexer;
}

@parser::header {
	interface IMacroSymbol {
		params?: string[];
		text: string;
	}
}

@parser::members {
	static globalSymbols = new Map<string, IMacroSymbol>();

	currentState: boolean[] = [true];
	currentSymbols = new Map<string, IMacroSymbol>();

	filePath: string;

	getSymbolValue(symbolName: string): IMacroSymbol | undefined {
		return this.currentSymbols.get(symbolName) || UCPreprocessorParser.globalSymbols.get(symbolName);
	}

	getCurrentState(): boolean {
		return this.currentState.length === 0 || this.currentState.every(c => c === true);
	}

	peekCurrentState(): boolean {
		return this.currentState.length === 0 || this.currentState[this.currentState.length - 1];
	}
}

macroProgram: macroStatement* EOF;
macroStatement: MACRO_CHAR macro;

callArguments: OPEN_PARENS (MACRO_SYMBOL (',' MACRO_SYMBOL)*)? CLOSE_PARENS;

macro returns[isActive: boolean, evaluatedTokens?: Token[]]
	: MACRO_DEFINE MACRO_SYMBOL (args=callArguments)? MACRO_TEXT?
	{
		$isActive = this.getCurrentState();
		if ($isActive) {
			const symbolToken = $MACRO_SYMBOL;
			const id = symbolToken && symbolToken.text;
			if (id) {
				let text = $MACRO_TEXT.text;
				this.currentSymbols.set(id.toLowerCase(), { text: text || '...' });
			}
		}
	} # macroDefine
	| MACRO_UNDEFINE MACRO_SYMBOL
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
	| KW_IF OPEN_PARENS (MACRO_CHAR expr=macroExpression) CLOSE_PARENS
	{
		$isActive = !!$expr.value && this.getCurrentState();
		this.currentState.push($isActive);
	} # macroIf
	| MACRO_ELSE_IF OPEN_PARENS (MACRO_CHAR expr=macroExpression) CLOSE_PARENS
	{
		if (this.peekCurrentState()) {
			this.currentState.pop();
			this.currentState.push(false);
			$isActive = false;
		 } else {
			const isActive = !!$expr.value;
		  	this.currentState.pop();
	     	this.currentState.push(isActive);

		  	$isActive = isActive && this.getCurrentState();
		}
	} # macroElseIf
	| KW_ELSE
	{
		if (this.peekCurrentState()) {
			this.currentState.pop();
			this.currentState.push(false);
			$isActive = false;
		} else {
			this.currentState.pop();
			$isActive = this.getCurrentState();
			this.currentState.push(true);
		}
	} # macroElse
	| MACRO_END_IF
	{
		$isActive = this.peekCurrentState();
		this.currentState.pop();
	} #macroEndIf
	| MACRO_INCLUDE
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

macroExpression returns[value: boolean | string]
	: MACRO_IS_DEFINED (OPEN_PARENS MACRO_SYMBOL? CLOSE_PARENS)
	{
		var id = $MACRO_SYMBOL.text;
		$value = id ? Boolean(this.getSymbolValue(id.toLowerCase())) : false;
	}
	| MACRO_NOT_DEFINED (OPEN_PARENS MACRO_SYMBOL? CLOSE_PARENS)
	{
		var id = $MACRO_SYMBOL.text;
		$value = id ? !Boolean(this.getSymbolValue(id.toLowerCase())) : true;
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
		if (id) {
			var macro = this.getSymbolValue(id.toLowerCase());
			$value = macro ? macro.text : false;
		}
		else $value = false;
	}
	;