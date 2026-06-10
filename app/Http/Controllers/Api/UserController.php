<?php
// UserController.php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppUser;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function login(Request $request)
    {
        $user = AppUser::where('username', strtolower($request->username))->first();

        if (!$user || $user->pass !== $request->password) {
            return response()->json(['error' => 'Username atau password salah!'], 401);
        }

        return response()->json([
            'username' => $user->username,
            'role'     => $user->role,
            'name'     => $user->name,
        ]);
    }

    public function index()
    {
        return response()->json(AppUser::all());
    }

    public function store(Request $request)
    {
        $user = AppUser::create([
            'username' => strtolower($request->username),
            'pass'     => $request->pass,
            'role'     => $request->role,
            'name'     => $request->name,
        ]);

        return response()->json(['success' => true, 'id' => $user->id]);
    }

    public function destroy($id)
    {
        $user = AppUser::findOrFail($id);
        if ($user->username === 'administrator') {
            return response()->json(['error' => 'Tidak bisa hapus administrator'], 403);
        }
        $user->delete();
        return response()->json(['success' => true]);
    }
}