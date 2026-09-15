<?php

namespace Modules\Usuarios\Enums;

enum UserRole: string
{
    case AdminMaster = 'admin_master';
    case Operador = 'operador';
}
