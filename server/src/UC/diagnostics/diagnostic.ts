import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver-types';
import { hasDefinedBaseType, isClassSymbol, isSymbol, isTypeSymbol, SymbolKindToName, TypeKindToName, UCTypeKind, type ISymbol, type ITypeSymbol, type UCSymbolKind } from '../Symbols';
import { ModifierFlags, type TypeFlags } from '../Symbols/ModifierFlags';

export interface IDiagnosticNode {
    readonly range: Range;
}

export class ErrorDiagnostic implements IDiagnosticNode {
    constructor(readonly range: Range, private message: string) {
    }

    toString(): string {
        return this.message;
    }
}

export interface IDiagnosticMessage {
    text: string;
    code?: string;
    severity?: DiagnosticSeverity | number
}

export interface IDiagnosticTemplate {
    range: Range;
    message: IDiagnosticMessage;
    args?: unknown[];

    custom?: { [key: string]: any } | Diagnostic;
}

export class DiagnosticCollection {
    private items: IDiagnosticTemplate[] = [];

    add(template: IDiagnosticTemplate) {
        this.items.push(template);
    }

    count(): number {
        return this.items.length;
    }

    toDiagnostic(): Diagnostic[] {
        return this.items.map(template => {
            const diagnostic: Diagnostic = {
                range: template.range,
                message: template.args
                    ? template.message.text.replace(
                        /\{(\d)\}/g,
                        (_match, index) => {
                            const arg = template.args![index];

                            if (arg && isSymbol(arg)) {
                                if (isTypeSymbol(arg)) {
                                    return typeToDisplayString(arg);
                                }

                                return symbolToDisplayString(arg)
                            }

                            return String(arg);
                        }
                    )
                    : template.message.text,
                severity: template.message.severity as DiagnosticSeverity,
                code: template.message.code,
                source: 'unrealscript'
            };

            return Object.assign(diagnostic, template.custom);
        });
    }

    clear(): void {
        this.items.splice(0, this.items.length);
    }
}

export function rangeToString(range: Range): string {
    return `(${range.start.line + 1}:${range.start.character + 1})`;
}

// See also UCFieldSymbol.buildModifiers (used for hoverinfo instead)
export function typeFlagsToDisplayString(
    flags: TypeFlags
): string | null {
    const modifiers = [];

    if (flags & ModifierFlags.ReadOnly) {
        modifiers.push('Const');
    }

    if (flags & ModifierFlags.Out) {
        modifiers.push('Out');
    }

    if (flags & ModifierFlags.Ref) {
        modifiers.push('Ref');
    }

    if (flags & ModifierFlags.Coerce) {
        modifiers.push('Coerce');
    }

    if (modifiers.length === 0) {
        return null;
    }

    return modifiers.join(' ');
}

export function typeToDisplayString(
    type: ITypeSymbol
): string {
    const typeModifiersText = typeFlagsToDisplayString(type.flags);

    const typeKind = type.getTypeKind();
    const typeText = typeKind === UCTypeKind.Object
        && type.getRef()
        && isClassSymbol(type.getRef()!)
        ? 'Class'
        : TypeKindToName.get(typeKind)!.text;

    const concatenatedTypeText = typeModifiersText
        ? `${typeModifiersText} ${typeText}`
        : typeText;

    if (hasDefinedBaseType(type)) {
        const baseTypeText = typeToDisplayString(type.baseType);

        return `(${concatenatedTypeText} <${baseTypeText}>)`;
    }

    if (type.getRef()) {
        const qualifiedTypeText = type.getRef()!.getPath();

        return `(${concatenatedTypeText} '${qualifiedTypeText}')`;
    }

    return `(${concatenatedTypeText})`;
}

export function typeKindToDisplayString(
    kind: UCTypeKind
): string {
    return TypeKindToName.get(kind)!.text;
}

export function symbolToDisplayString(
    symbol: ISymbol
): string {
    return `${SymbolKindToName.get(symbol.kind)!.text} '${symbol.getPath()}'`;
}

export function symbolKindToDisplayString(
    kind: UCSymbolKind
): string {
    return SymbolKindToName.get(kind)!.text;
}

export function createExpectedTypeMessage(
    destType: ITypeSymbol,
    inputType: ITypeSymbol
): IDiagnosticMessage {
    return {
        text: `Expected type ${typeToDisplayString(destType)}, but got type ${typeToDisplayString(inputType)}`,
        severity: DiagnosticSeverity.Error
    };
}

export function createTypeCannotBeAssignedToMessage(
    destType: ITypeSymbol,
    inputType: ITypeSymbol
): IDiagnosticMessage {
    return {
        text: `Type ${typeToDisplayString(inputType)} is not assignable to type ${typeToDisplayString(destType)}`,
        severity: DiagnosticSeverity.Error
    };
}

