<?php

namespace Modules\Usuarios\Http\Requests\Operator;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class StoreOperatorRequest extends FormRequest
{
    /**
     * Only an authenticated admin master may register new operators.
     */
    public function authorize(): bool
    {
        return $this->user()?->isAdminMaster() ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', Password::defaults()],
        ];
    }

    /**
     * Messages fixed by REQUISITOS.md §4.5.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.unique' => 'Este e-mail já está cadastrado.',
            'password.min' => 'A senha deve ter pelo menos 8 caracteres.',
        ];
    }
}
