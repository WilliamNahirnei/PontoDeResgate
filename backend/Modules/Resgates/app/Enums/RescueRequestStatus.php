<?php

namespace Modules\Resgates\Enums;

enum RescueRequestStatus: string
{
    case Pendente = 'pendente';
    case EmResgate = 'em_resgate';
    case Concluido = 'concluido';
    case Cancelado = 'cancelado';
}
