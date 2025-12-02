# Block Validity Rules - Visual Guide

## Valid vs Invalid Blocks

### PROVIDING Blocks

A providing block represents a parent providing care to children.

#### ✅ VALID: Has at least one child from another parent

```
╔══════════════════════════════════════════╗
║  Karen's PROVIDING Block (Oct 27)       ║
║  07:30-11:30                             ║
╠══════════════════════════════════════════╣
║  Children:                               ║
║  • Karen (Karen's child)        ✅       ║
║  • Rosmary (Rosmary's child)    ✅       ║
╚══════════════════════════════════════════╝
Status: VALID - Karen provides care to Rosmary
```

```
╔══════════════════════════════════════════╗
║  Hugo's PROVIDING Block (Oct 27)         ║
║  07:30-11:30                             ║
╠══════════════════════════════════════════╣
║  Children:                               ║
║  • Hugo (Hugo's child)          ✅       ║
║  • Bruce (Bruce's child)        ✅       ║
║  • Karen (Karen's child)        ✅       ║
╚══════════════════════════════════════════╝
Status: VALID - Hugo provides care to Bruce & Karen
```

#### ❌ INVALID: Only has provider's own child

```
╔══════════════════════════════════════════╗
║  Karen's PROVIDING Block (Oct 27)       ║
║  07:30-11:30                             ║
╠══════════════════════════════════════════╣
║  Children:                               ║
║  • Karen (Karen's child)        ⚠️       ║
╚══════════════════════════════════════════╝
Status: INVALID - Can't provide care to only yourself
Action: DELETE THIS BLOCK ❌
```

### NEEDED Blocks

A needed block represents a parent receiving care for their children.

#### ✅ VALID: Contains the needing parent's own child

```
╔══════════════════════════════════════════╗
║  Rosmary's NEEDED Block (Oct 27)         ║
║  07:30-11:30                             ║
║  Provider: Hugo                          ║
╠══════════════════════════════════════════╣
║  Children:                               ║
║  • Hugo (Hugo's child)          ✅       ║
║  • Rosmary (Rosmary's child)    ✅       ║
╚══════════════════════════════════════════╝
Status: VALID - Rosmary's child is present
```

```
╔══════════════════════════════════════════╗
║  Bruce's NEEDED Block (Oct 27)           ║
║  07:30-11:30                             ║
║  Provider: Hugo                          ║
╠══════════════════════════════════════════╣
║  Children:                               ║
║  • Hugo (Hugo's child)          ✅       ║
║  • Bruce (Bruce's child)        ✅       ║
║  • Karen (Karen's child)        ✅       ║
╚══════════════════════════════════════════╝
Status: VALID - Bruce's child is present
```

#### ❌ INVALID: Missing the needing parent's own child

```
╔══════════════════════════════════════════╗
║  Rosmary's NEEDED Block (Oct 27)         ║
║  07:30-11:30                             ║
║  Provider: Hugo                          ║
╠══════════════════════════════════════════╣
║  Children:                               ║
║  • Hugo (Hugo's child)          ⚠️       ║
╚══════════════════════════════════════════╝
Status: INVALID - Rosmary's child is NOT present
Action: DELETE THIS BLOCK ❌
```

## Real-World Scenario

### Initial State: Everyone accepted

```
HUGO'S CALENDAR
╔═══════════════════════════════════════╗
║  PROVIDING Block (Oct 27 07:30-11:30) ║
╠═══════════════════════════════════════╣
║  • Hugo (own child)                    ║
║  • Rosmary                             ║
║  • Bruce                               ║
║  • Karen                               ║
╚═══════════════════════════════════════╝

ROSMARY'S CALENDAR
╔═══════════════════════════════════════╗
║  NEEDED Block (Oct 27 07:30-11:30)    ║
║  Provider: Hugo                        ║
╠═══════════════════════════════════════╣
║  • Hugo                                ║
║  • Rosmary (own child)                 ║
║  • Bruce                               ║
║  • Karen                               ║
╚═══════════════════════════════════════╝

BRUCE'S CALENDAR
╔═══════════════════════════════════════╗
║  NEEDED Block (Oct 27 07:30-11:30)    ║
║  Provider: Hugo                        ║
╠═══════════════════════════════════════╣
║  • Hugo                                ║
║  • Rosmary                             ║
║  • Bruce (own child)                   ║
║  • Karen                               ║
╚═══════════════════════════════════════╝

KAREN'S CALENDAR
╔═══════════════════════════════════════╗
║  NEEDED Block (Oct 27 07:30-11:30)    ║
║  Provider: Hugo                        ║
╠═══════════════════════════════════════╣
║  • Hugo                                ║
║  • Rosmary                             ║
║  • Bruce                               ║
║  • Karen (own child)                   ║
╚═══════════════════════════════════════╝
```

### After: Hugo counters, Rosmary declines

#### Step 1: Remove Rosmary's child from all blocks

```
HUGO'S CALENDAR
╔═══════════════════════════════════════╗
║  PROVIDING Block (Oct 27 07:30-11:30) ║
╠═══════════════════════════════════════╣
║  • Hugo (own child)                    ║
║  • Bruce                               ║
║  • Karen                               ║
╚═══════════════════════════════════════╝
✅ VALID - Has other children

ROSMARY'S CALENDAR
╔═══════════════════════════════════════╗
║  NEEDED Block (Oct 27 07:30-11:30)    ║
║  Provider: Hugo                        ║
╠═══════════════════════════════════════╣
║  • Hugo                                ║
║  • Bruce                               ║
║  • Karen                               ║
╚═══════════════════════════════════════╝
❌ INVALID - Missing Rosmary's child
🗑️  DELETE THIS BLOCK

BRUCE'S CALENDAR
╔═══════════════════════════════════════╗
║  NEEDED Block (Oct 27 07:30-11:30)    ║
║  Provider: Hugo                        ║
╠═══════════════════════════════════════╣
║  • Hugo                                ║
║  • Bruce (own child)                   ║
║  • Karen                               ║
╚═══════════════════════════════════════╝
✅ VALID - Bruce's child is present

KAREN'S CALENDAR
╔═══════════════════════════════════════╗
║  NEEDED Block (Oct 27 07:30-11:30)    ║
║  Provider: Hugo                        ║
╠═══════════════════════════════════════╣
║  • Hugo                                ║
║  • Bruce                               ║
║  • Karen (own child)                   ║
╚═══════════════════════════════════════╝
✅ VALID - Karen's child is present
```

### After: Karen counters, Rosmary declines

#### Step 1: Remove Rosmary's child from Karen's block

```
KAREN'S CALENDAR
╔═══════════════════════════════════════╗
║  PROVIDING Block (Oct 27 07:30-11:30) ║
╠═══════════════════════════════════════╣
║  • Karen (own child)                   ║
╚═══════════════════════════════════════╝
❌ INVALID - Only own child
🗑️  DELETE THIS BLOCK

ROSMARY'S CALENDAR
╔═══════════════════════════════════════╗
║  NEEDED Block (Oct 27 07:30-11:30)    ║
║  Provider: Karen                       ║
╠═══════════════════════════════════════╣
║  • Karen                               ║
╚═══════════════════════════════════════╝
❌ INVALID - Missing Rosmary's child
🗑️  DELETE THIS BLOCK
```

## Summary Table

| Block Type | Must Have | Cannot Have Only | Example Valid | Example Invalid |
|------------|-----------|------------------|---------------|-----------------|
| **Providing** | At least 1 child from another parent | Provider's own child only | Karen + Rosmary | Karen only |
| **Needed** | Needing parent's own child | Provider's child only | Rosmary + Hugo | Hugo only |

## The Fix in Plain English

**When a counter is declined:**

1. Remove the rescheduler's child from ALL blocks (providing and needed)
2. Look at every providing block:
   - If it has zero children → DELETE
   - If it only has the provider's own child → DELETE
   - If it has other children → KEEP
3. Look at every needed block:
   - If it has zero children → DELETE
   - If it's missing the needing parent's own child → DELETE
   - If it has the needing parent's child → KEEP

**Result:** Only meaningful blocks remain on calendars!
