<?php

namespace Modules\Usuarios\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Modules\Resgates\Models\RescueRequest;
use Modules\Usuarios\Database\Factories\UserFactory;
use Modules\Usuarios\Enums\UserRole;

#[Fillable(['name', 'email', 'password', 'role', 'active'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected static function newFactory(): UserFactory
    {
        return UserFactory::new();
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'active' => 'boolean',
        ];
    }

    public function isAdminMaster(): bool
    {
        return $this->role === UserRole::AdminMaster;
    }

    public function isOperador(): bool
    {
        return $this->role === UserRole::Operador;
    }

    /**
     * @return HasMany<RescueRequest, $this>
     */
    public function rescueRequestsAsOperator(): HasMany
    {
        return $this->hasMany(RescueRequest::class, 'operator_id');
    }
}
