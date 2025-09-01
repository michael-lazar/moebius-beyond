declare global {
    namespace App {
        type Selection = {
            sx: number;
            sy: number;
            dx: number;
            dy: number;
        };

        type Blocks = {
            columns: number;
            rows: number;
            data: any[];
        };
    }

    interface HTMLElement {
        [key: string]: any;
    }
}

export {};
