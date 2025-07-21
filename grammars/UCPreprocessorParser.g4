parser grammar UCPreprocessorParser;

options {
    tokenVocab = UCLexer;
}

@parser::header {
    import { MacroSymbol, MacroProvider } from '../../Parser/MacroProvider';

    export class MacroState {
        private stack: boolean[] = [];

        push(state: boolean): void {
            this.stack.push(state);
        }

        pop(): void {
            this.stack.pop();
        }

        peek(): boolean {
            return this.stack.length === 0 || this.stack[this.stack.length - 1];
        }

        isActive(): boolean {
            return this.stack.every(c => c === true);
        }

        isNeutral(): boolean {
            return this.stack.length === 0;
        }
    }
}

@parser::members {
    macroProvider: MacroProvider;
    macroState: MacroState;
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
    | MACRO_CHAR { throw new RecognitionException (undefined, this._input); }
    ;

macroPrimaryExpression returns[isActive: boolean, value: string]
    : MACRO_DEFINE MACRO_DEFINE_SYMBOL (OPEN_PARENS params=macroParameters CLOSE_PARENS)? MACRO_TEXT?
    {
        $isActive = this.macroState.isActive();
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
        $isActive = this.macroState.isActive();
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
        $isActive = this.macroState.isActive()
            && typeof $macroExpression.value === 'string'
            && $macroExpression.value.length > 0
            && $macroExpression.value !== '0'
            && $macroExpression.value.toLowerCase() !== 'false'
            ;
        this.macroState.push($isActive);
        console.info('if push');
    } # macroIf
    | MACRO_ELSE_IF (OPEN_PARENS arg=macroExpression CLOSE_PARENS)
    {
        if (this.macroState.isActive()) {
            this.macroState.pop();
            this.macroState.push(false);
            $isActive = false;
         } else {
            this.macroState.pop();
            $isActive = this.macroState.isActive()
                && typeof $macroExpression.value === 'string'
                && $macroExpression.value.length > 0
                && $macroExpression.value !== '0'
                && $macroExpression.value.toLowerCase() !== 'false'
                ;
            this.macroState.push($isActive);
        }
        console.info('if push');
    } # macroElseIf
    | MACRO_ELSE
    {
        if (this.macroState.isActive()) {
            this.macroState.pop();
            this.macroState.push(false);
            $isActive = false;
        } else {
            this.macroState.pop();
            this.macroState.push(true);
            $isActive = this.macroState.isActive();
        }
        console.info('else pop');
    } # macroElse
    | MACRO_END_IF
    {
        $isActive = this.macroState.isActive();
        this.macroState.pop();
        console.info('endif pop');
    } #macroEndIf
    | MACRO_INCLUDE (OPEN_PARENS arg=macroArgument CLOSE_PARENS)
    {
        $isActive = this.macroState.isActive();
    } #macroInclude
    | MACRO_IS_DEFINED (OPEN_PARENS arg=macroArgument CLOSE_PARENS)
    {
        var id = $macroArgument.value;
        $value = id && this.macroProvider.getSymbol(id.toLowerCase()) ? '1' : '';
        $isActive = this.macroState.isActive();
    } #macroIsDefined
    | MACRO_NOT_DEFINED (OPEN_PARENS arg=macroArgument CLOSE_PARENS)
    {
        var id = $macroArgument.value;
        $value = id && this.macroProvider.getSymbol(id.toLowerCase()) ? '' : '1';
        $isActive = this.macroState.isActive();
    } # macroIsNotDefined
    // Commented out (hardcoded in PreprocessorMacroTransformer.ts), because for some reason the parser does not respect the conditional...
    // | macro=MACRO_SYMBOL { $macro && $macro.text === '__LINE__' }?
    // { $isActive = this.macroState.isActive(); } # macroSymbolLine
    // Commented out (hardcoded in PreprocessorMacroTransformer.ts), because for some reason the parser does not respect the conditional...
    // | macro=MACRO_SYMBOL { $macro && $macro.text === '__FILE__' }?
    // { $isActive = this.macroState.isActive(); } # macroSymbolFile
    | MACRO_SYMBOL (OPEN_PARENS args=macroArguments CLOSE_PARENS)?
    {
        var symbolToken = $MACRO_SYMBOL;
        $value = this.macroProvider.getSymbol(symbolToken.text.toLowerCase()) ?? '';
        $isActive = !!$value;
    } # macroInvoke
    ;
