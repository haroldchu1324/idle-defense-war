# Debug Steps

## 1. Get detailed error message
Click on the error objects in console to expand them and copy the full error details.

## 2. Test basic auth
Try this in Supabase SQL editor:
```sql
SELECT idw_get_state();
```

## 3. Check if user authenticated
In browser console, check:
```js
console.log('Current user:', currentUser);
console.log('Auth status:', !!currentUser);
```

## 4. Test simple battle function manually
In Supabase SQL editor:
```sql
SELECT idw_ensure_player();
```