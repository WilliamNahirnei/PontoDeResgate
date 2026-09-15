<?php

namespace Modules\Resgates\Providers;

use Illuminate\Console\Scheduling\Schedule;
use Modules\Resgates\Repositories\Contracts\RescueRequestRepositoryInterface;
use Modules\Resgates\Repositories\Contracts\RescueStatusLogRepositoryInterface;
use Modules\Resgates\Repositories\RescueRequestRepository;
use Modules\Resgates\Repositories\RescueStatusLogRepository;
use Nwidart\Modules\Support\ModuleServiceProvider;

class ResgatesServiceProvider extends ModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Resgates';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'resgates';

    /**
     * Command classes to register.
     *
     * @var string[]
     */
    // protected array $commands = [];

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        RouteServiceProvider::class,
    ];

    /**
     * Register the module's sub-providers and bind its repository interfaces
     * to their Eloquent implementations.
     */
    public function register(): void
    {
        parent::register();

        $this->app->bind(RescueRequestRepositoryInterface::class, RescueRequestRepository::class);
        $this->app->bind(RescueStatusLogRepositoryInterface::class, RescueStatusLogRepository::class);
    }

    /**
     * Define module schedules.
     *
     * @param  $schedule
     */
    // protected function configureSchedules(Schedule $schedule): void
    // {
    //     $schedule->command('inspire')->hourly();
    // }
}
