parser grammar UCPreprocessorParser;

options {
    tokenVocab = UCLexer;
}

@parser::header {
    import { MacroSymbol, MacroProvider } from '../../Parser/MacroProvider';
}

@parser::members {
    macroProvider: MacroProvider;

    currentState: boolean[] = [true];

    getCurrentState(): boolean {
        return this.currentState.length === 0 || this.currentState.every(c => c === true);
    }

    peekCurrentState(): boolean {
        return this.currentState.length === 0 || this.currentState[this.currentState.length - 1];
    }
}

macroProgram: macroExpression* EOF;

macroEmptyArgument
    : ','
    ;

macroArgument returns[value: string]
    : MACRO_SYMBOL
    {
        $value = $MACRO_SYMBOL.text;
    }
    ;

// allow skipping of params
// `macro(, s, test,,)
macroArguments
    : (macroEmptyArgument | (COMMA macroArgument)+ | (macroArgument COMMA?))+
    ;

macroParameters
    : MACRO_SYMBOL (',' MACRO_SYMBOL)*
    ;

macroExpression returns[value: string]
    // << `{endif} or `{macroName(param,param2)}
    : MACRO_CHAR (OPEN_BRACE expr=macroPrimaryExpression CLOSE_BRACE)
    { $value = $macroPrimaryExpression.value; }
    | MACRO_CHAR expr=macroPrimaryExpression
    { $value = $macroPrimaryExpression.value; }
    ;

macroPrimaryExpression returns[value: string]
    : macroInvocation
    {
        $value = $macroInvocation.value;
    }
    | macroSecondaryExpression
    {
        $value = $macroSecondaryExpression.value;
    }
    ;

macroSecondaryExpression returns[isActive: boolean, value: string]
    : MACRO_DEFINE MACRO_DEFINE_SYMBOL (OPEN_PARENS params=macroParameters CLOSE_PARENS)? MACRO_TEXT?
    {
        $isActive = this.getCurrentState();
        if ($isActive) {
            const symbolToken = $MACRO_DEFINE_SYMBOL;
            const id = symbolToken && symbolToken.text;
            if (id) {
                let text = $MACRO_TEXT?.text || '';
                // TODO: Re-factor, just wanted to get it working quickly for now.
                const macroDef: MacroSymbol = {
                    text: text,
                    params: undefined
                };
                if ((_localctx as MacroDefineContext)._params) {
                    macroDef.params = (_localctx as MacroDefineContext)._params.MACRO_SYMBOL()?.map(s => s.text);
                }
                this.macroProvider.setSymbol(id.toLowerCase(), macroDef);
            }
        }
    } # macroDefine
    | MACRO_UNDEFINE (OPEN_PARENS arg=macroArgument CLOSE_PARENS)
    {
        $isActive = this.getCurrentState();
        if ($isActive) {
            const symbolToken = $macroArgument.value;
            const id = symbolToken;
            if (id) {
                this.macroProvider.deleteSymbol(id.toLowerCase());
            }
        }
    } # macroUndefine
    | MACRO_IF (OPEN_PARENS arg=macroExpression CLOSE_PARENS)
    {
        $isActive = this.getCurrentState()
            && typeof $macroExpression.value === 'string'
            && $macroExpression.value.length > 0
            && $macroExpression.value !== '0'
            && $macroExpression.value.toLowerCase() !== 'false'
            ;
        this.currentState.push($isActive);
    } # macroIf
    | MACRO_ELSE_IF (OPEN_PARENS arg=macroExpression CLOSE_PARENS)
    {
        if (this.peekCurrentState()) {
            this.currentState.pop();
            this.currentState.push(false);
            $isActive = false;
         } else {
            const isActive = !!$macroExpression.value;
            this.currentState.pop();
            this.currentState.push(isActive);

            $isActive = isActive && this.getCurrentState();
        }
    } # macroElseIf
    | MACRO_ELSE
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
    | MACRO_INCLUDE (OPEN_PARENS arg=macroArgument CLOSE_PARENS)
    { $isActive = this.peekCurrentState(); } #macroInclude
    | MACRO_IS_DEFINED (OPEN_PARENS arg=macroArgument CLOSE_PARENS)
    {
        var id = $macroArgument.value;
        $value = id && this.macroProvider.getSymbol(id.toLowerCase()) ? '1' : '';
        $isActive = this.peekCurrentState();
    } #macroIsDefined
    | MACRO_NOT_DEFINED (OPEN_PARENS arg=macroArgument CLOSE_PARENS)
    {
        var id = $macroArgument.value;
        $value = id && this.macroProvider.getSymbol(id.toLowerCase()) ? '' : '1';
        $isActive = this.peekCurrentState();
    } # macroIsNotDefined
    // Commented out (hardcoded in PreprocessorMacroTransformer.ts), because for some reason the parser does not respect the conditional...
    // | macro=MACRO_SYMBOL { $macro && $macro.text === '__LINE__' }?
    // { $isActive = this.peekCurrentState(); } # macroSymbolLine
    // Commented out (hardcoded in PreprocessorMacroTransformer.ts), because for some reason the parser does not respect the conditional...
    // | macro=MACRO_SYMBOL { $macro && $macro.text === '__FILE__' }?
    // { $isActive = this.peekCurrentState(); } # macroSymbolFile
    ;

macroInvocation returns[value: string]
    : MACRO_SYMBOL
    {
        var symbolToken = $MACRO_SYMBOL;
        $value = symbolToken && symbolToken.text || '';
    }
    | MACRO_SYMBOL (OPEN_PARENS args=macroArguments? CLOSE_PARENS)
    {
        var symbolToken = $MACRO_SYMBOL;
        $value = symbolToken && symbolToken.text || '';
    }
    ;
