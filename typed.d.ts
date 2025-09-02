declare global {
    namespace App {
        type Font = {
            [key: string]: any;
        };

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
            transparent?: boolean;
        };

        type Render = {
            columns: number;
            rows: number;
            width: number;
            height: number;
            ice_color_collection: HTMLCanvasElement[];
            blink_on_collection: HTMLCanvasElement[];
            blink_off_collection: HTMLCanvasElement[];
            preview_collection: HTMLCanvasElement[];
            maximum_rows: number;
            font: App.Font;
        };
    }

    interface HTMLElement {
        [key: string]: any;
    }
}

export {};
