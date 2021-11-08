/**
 * The purpose of this document is to test support and possibilties of special-case const expressions.
 * i.e. The UC compiler can evuaulate const any (non-assignment) expression as long as the returned type is supported.
 * This is however only true for within the arraycount and nameof, so called "sizeof" like features.
 *
 * Additionally such expressions are context sensitivie, meaning they are evuaulated on the spot,
   -- and therefore properties defined later are inaccessible.
 */
const CONST_ARRAYCOUNT              = arraycount(class'Test'.default.CONST_ARRAY);
const CONST_NAMEOF                  = nameof(class'Test'.default.CONST_NAME);