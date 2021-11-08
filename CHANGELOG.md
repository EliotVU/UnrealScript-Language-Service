# UnrealScript Language Service

## 0.5.0
    
- Autocomplete and IntelliSense
    - Has been displaced with the help of a third-party library [c3](https://github.com/mike-lischke/antlr4-c3)
    - This switch has made it much easier to implement context-aware autocompletes, but more work will be needed to bring it the quality that we all take for granted in popular languages :) 
  
- Added the first CodeAction
    - If a type is missing where a class type is expected, the service will now suggest to generate the class for you.
    
- Syntax highlighting has seen some improvements
    - C++ highlighting in cpptext and structcpptext and fragments.
    - Various tweaks.
  
- Added missing parameters to UC3 Array intrinsics
    ```UnrealScript 
    // This should no longer output a missing argument error.
    ArrayRef.find(value)
    ``` 
 
- NameOf and ArrayCount with an expressive argument are now recognized
    ```UnrealScript 
    // Even works in const assignments!
    const MY_ARRAYCOUNT              = arraycount(class'Object'.default.ObjectInternal);
    const MY_NAMEOF                  = nameof(class'Object'.default.ObjectInternal);
    ``` 

- Intrinsic (a relict of UC1) is now a recognized keyword for variables
    ```UnrealScript 
    var intrinsic int myInteger;
    ``` 
    
- Added a new configuration option
    - Licensee - Epic|XCom
    
    This option tells the service which UnrealScript edition it should optimize for.
  
- Quality of Life
    - Fixed [Closing unopened comment](https://github.com/EliotVU/UnrealScript-Language-Service/issues/28)
    - Fixed ["default:" is not highlighted](https://github.com/EliotVU/UnrealScript-Language-Service/issues/22)
    - Fixed ["Spawn" return type is not coerced to its first parameter's type. #21](https://github.com/EliotVU/UnrealScript-Language-Service/issues/21)
    - Fixed ["no viable alternative at input 'return A -='"](https://github.com/EliotVU/UnrealScript-Language-Service/issues/20)
    - Fixed [Highlighting issue regarding a comment if on the same line as a struct declaration #19](https://github.com/EliotVU/UnrealScript-Language-Service/issues/19)
    - Fixed [Class and package name confusion](https://github.com/EliotVU/UnrealScript-Language-Service/issues/15)
    - Fixed ["const ref" argument confusing the parser](https://github.com/EliotVU/UnrealScript-Language-Service/issues/14)
